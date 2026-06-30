"""
Storage backend abstraction.

Two backends, same interface:

- S3Backend     — real AWS S3 / Cloudflare R2 via boto3 presigned URLs.
- LocalBackend  — fallback that writes to ./storage/<key> on disk and
                   issues short-lived HMAC-signed URLs served by our own
                   /storage/upload/{token} and /storage/download/{token}
                   routes, so the frontend's "PUT to a URL, then confirm"
                   flow works identically regardless of which backend
                   is active.

get_storage() decides which backend to use at import time, based on
whether STORAGE_* envs are present and look valid. If they're missing
or malformed, it falls back to LocalBackend automatically — no crash,
no manual toggle needed for local dev.

Key scheme is shared by both backends: resumes/<candidate_id>/v<n>/<filename>
This means switching from local to real S3/R2 later requires no changes
to how keys are built — only the backend selection changes.
"""

import hashlib
import hmac
import json
import mimetypes
import time
from pathlib import Path
from typing import Protocol

from app.core.config import settings
from app.core.logging import logger


# ---------------------------------------------------------------------------
# Storage root — <repo_root>/storage
# ---------------------------------------------------------------------------

# This file lives at backend/app/storage_backends.py, so repo root is
# three levels up: app/ -> backend/ -> <repo_root>/storage
REPO_ROOT = Path(__file__).resolve().parents[2]
LOCAL_STORAGE_ROOT = REPO_ROOT / "storage"


# ---------------------------------------------------------------------------
# Backend interface
# ---------------------------------------------------------------------------

class StorageBackend(Protocol):
    def generate_presigned_upload_url(self, s3_key: str, content_type: str, expires_in: int) -> str: ...
    def generate_presigned_download_url(self, s3_key: str, expires_in: int) -> str: ...


# ---------------------------------------------------------------------------
# S3 / R2 backend
# ---------------------------------------------------------------------------

class S3Backend:
    """Real S3-compatible storage (AWS S3 or Cloudflare R2) via boto3."""

    def __init__(self):
        import boto3
        from botocore.config import Config

        kwargs: dict = dict(
            aws_access_key_id=settings.STORAGE_ACCESS_KEY_ID,
            aws_secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY.get_secret_value(),
            region_name=settings.STORAGE_REGION,
            config=Config(signature_version="s3v4"),
        )
        if settings.STORAGE_ENDPOINT_URL:
            kwargs["endpoint_url"] = settings.STORAGE_ENDPOINT_URL

        self._client = boto3.client("s3", **kwargs)
        self._bucket = settings.STORAGE_BUCKET

    def generate_presigned_upload_url(self, s3_key: str, content_type: str, expires_in: int) -> str:
        return self._client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": s3_key, "ContentType": content_type},
            ExpiresIn=expires_in,
            HttpMethod="PUT",
        )

    def generate_presigned_download_url(self, s3_key: str, expires_in: int) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": s3_key},
            ExpiresIn=expires_in,
        )


# ---------------------------------------------------------------------------
# Local disk backend (fallback for dev / missing or invalid envs)
# ---------------------------------------------------------------------------

class LocalBackend:
    """
    Fallback storage that writes files under ./storage/<s3_key> on disk.

    Files are organised exactly like the S3 key scheme would lay them out:

        storage/
          resumes/
            <candidate_id>/
              v1/
                resume.pdf
                resume.pdf.meta.json   <- content-type, uploaded_at, original filename
              v2/
                resume_updated.pdf
                resume_updated.pdf.meta.json

    Each upload gets its own subfolder (one per version, per candidate) so
    nothing is ever dumped flat into a single directory, and the structure
    is browsable/manageable directly on disk.

    Since there's no real S3 to presign against, this backend issues a
    short-lived HMAC-signed token. The actual bytes move through our own
    FastAPI routes (see router/routes/storage.py), which validate the
    signature + expiry before reading/writing to disk.
    """

    def __init__(self):
        LOCAL_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
        logger.info(f"Using LOCAL storage backend — files stored under {LOCAL_STORAGE_ROOT}")

    # -- path helpers ---------------------------------------------------

    def _resolve_path(self, s3_key: str) -> Path:
        """
        Resolves an s3_key like 'resumes/<id>/v1/file.pdf' to an absolute
        path under the storage root, and rejects path traversal attempts.
        """
        candidate = (LOCAL_STORAGE_ROOT / s3_key).resolve()
        if not str(candidate).startswith(str(LOCAL_STORAGE_ROOT.resolve())):
            raise ValueError("Invalid storage key — path traversal detected")
        return candidate

    def _meta_path(self, file_path: Path) -> Path:
        return file_path.with_suffix(file_path.suffix + ".meta.json")

    # -- signed token helpers --------------------------------------------

    def _sign(self, payload: dict) -> str:
        body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        body_b64 = _b64url_encode(body.encode())
        secret = settings.JWT_SECRET_KEY.get_secret_value().encode()
        sig = hmac.new(secret, body_b64.encode(), hashlib.sha256).hexdigest()
        return f"{body_b64}.{sig}"

    def verify_token(self, token: str) -> dict:
        """Raises ValueError if the token is malformed, expired, or tampered with."""
        try:
            body_b64, sig = token.split(".", 1)
        except ValueError:
            raise ValueError("Malformed storage token")

        secret = settings.JWT_SECRET_KEY.get_secret_value().encode()
        expected_sig = hmac.new(secret, body_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("Invalid storage token signature")

        payload = json.loads(_b64url_decode(body_b64))
        if payload.get("exp", 0) < time.time():
            raise ValueError("Storage token has expired")

        return payload

    # -- public interface -------------------------------------------------

    def generate_presigned_upload_url(self, s3_key: str, content_type: str, expires_in: int) -> str:
        token = self._sign({
            "key": s3_key,
            "content_type": content_type,
            "op": "upload",
            "exp": time.time() + expires_in,
        })
        base = settings.OAUTH_REDIRECT_BASE_URL.rstrip("/")
        return f"{base}/api/v1/storage/upload/{token}"

    def generate_presigned_download_url(self, s3_key: str, expires_in: int) -> str:
        token = self._sign({
            "key": s3_key,
            "op": "download",
            "exp": time.time() + expires_in,
        })
        base = settings.OAUTH_REDIRECT_BASE_URL.rstrip("/")
        return f"{base}/api/v1/storage/download/{token}"

    # -- disk I/O, called by the storage routes --------------------------

    def write_file(self, s3_key: str, content_type: str, data: bytes, original_filename: str = "") -> None:
        """Writes file bytes + a sidecar metadata file into its own subfolder."""
        path = self._resolve_path(s3_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

        meta = {
            "content_type": content_type,
            "original_filename": original_filename or path.name,
            "size_bytes": len(data),
            "uploaded_at": time.time(),
        }
        self._meta_path(path).write_text(json.dumps(meta, indent=2))

    def read_file(self, s3_key: str) -> tuple[bytes, str]:
        """Returns (file_bytes, content_type) for a stored file."""
        path = self._resolve_path(s3_key)
        if not path.exists():
            raise FileNotFoundError(f"No file stored at key: {s3_key}")

        content_type = "application/octet-stream"
        meta_path = self._meta_path(path)
        if meta_path.exists():
            try:
                content_type = json.loads(meta_path.read_text()).get(
                    "content_type", content_type
                )
            except (json.JSONDecodeError, OSError):
                pass
        else:
            guessed, _ = mimetypes.guess_type(str(path))
            if guessed:
                content_type = guessed

        return path.read_bytes(), content_type


def _b64url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    import base64
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


# ---------------------------------------------------------------------------
# Backend selection
# ---------------------------------------------------------------------------

def _s3_config_looks_valid() -> bool:
    """
    Checks whether the STORAGE_* envs are present and minimally well-formed
    enough to attempt real S3/R2 usage. Does NOT make a network call —
    just validates presence and obvious shape, so startup stays fast and
    doesn't fail hard if R2/S3 is temporarily unreachable.
    """
    if not settings.STORAGE_ACCESS_KEY_ID or not settings.STORAGE_ACCESS_KEY_ID.strip():
        return False
    if not settings.STORAGE_SECRET_ACCESS_KEY.get_secret_value().strip():
        return False
    if not settings.STORAGE_BUCKET or not settings.STORAGE_BUCKET.strip():
        return False
    # If an endpoint URL is set (R2 case), it must look like a URL
    if settings.STORAGE_ENDPOINT_URL and not settings.STORAGE_ENDPOINT_URL.startswith(
        ("http://", "https://")
    ):
        return False
    return True


_backend_instance: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """
    Returns a singleton storage backend. Picks S3Backend if STORAGE_* envs
    look valid and boto3 initialises cleanly; otherwise falls back to
    LocalBackend automatically and logs why.
    """
    global _backend_instance
    if _backend_instance is not None:
        return _backend_instance

    if _s3_config_looks_valid():
        try:
            _backend_instance = S3Backend()
            logger.info("Using S3/R2 storage backend")
            return _backend_instance
        except Exception as exc:
            logger.warning(
                f"STORAGE_* envs present but S3 client failed to initialise "
                f"({exc}) — falling back to local disk storage."
            )
    else:
        logger.info(
            "STORAGE_* envs missing or incomplete — using local disk storage fallback."
        )

    _backend_instance = LocalBackend()
    return _backend_instance