"""
Storage helper — public interface used by routes.

Delegates to whichever backend app.storage_backends.get_storage() selects:
- S3Backend (real AWS S3 / Cloudflare R2) when STORAGE_* envs are valid
- LocalBackend (disk under ./storage/) as an automatic fallback otherwise

Routes should only ever import from this module, not from storage_backends
directly (the storage routes in router/routes/storage.py are the one
exception, since they need read_file/write_file/verify_token which are
local-disk-specific operations).
"""

from app.storage_backends import get_storage


def generate_presigned_upload_url(
    s3_key: str,
    content_type: str,
    expires_in: int = 300,  # 5 minutes is plenty for a resume upload
) -> str:
    """
    Generates a presigned (or locally-signed) PUT URL.
    The frontend uploads the raw file bytes directly to this URL —
    the file does not pass through this function or sit in memory here.
    """
    return get_storage().generate_presigned_upload_url(s3_key, content_type, expires_in)


def generate_presigned_download_url(
    s3_key: str,
    expires_in: int = 900,  # 15 minutes
) -> str:
    """Generates a presigned (or locally-signed) GET URL for a stored file."""
    return get_storage().generate_presigned_download_url(s3_key, expires_in)