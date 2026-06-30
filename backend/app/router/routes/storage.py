"""
Local storage routes — backing implementation for LocalBackend's
"presigned" URLs.

These routes only do real work when the app is running on the local
disk fallback (no valid STORAGE_* envs). If S3Backend is active, these
routes are simply never hit — the frontend talks to the real S3/R2
presigned URL instead.

PUT  /storage/upload/{token}    → frontend uploads file bytes here
GET  /storage/download/{token}  → frontend downloads file bytes here

The token is an HMAC-signed, time-limited payload created by
LocalBackend.generate_presigned_upload_url / generate_presigned_download_url.
No auth dependency is needed beyond the token itself — knowledge of a
valid, unexpired token is the access control, exactly like a real
presigned S3 URL.
"""

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.storage_backends import LocalBackend, get_storage

router = APIRouter(prefix="/storage", tags=["storage"])


def _require_local_backend() -> LocalBackend:
    backend = get_storage()
    if not isinstance(backend, LocalBackend):
        # Shouldn't normally be reachable — if S3Backend is active, the
        # frontend was given a real S3/R2 URL and would never hit this route.
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Local storage routes are inactive — S3/R2 backend is in use.",
        )
    return backend


@router.put("/upload/{token}")
async def upload_to_local_storage(token: str, request: Request):
    backend = _require_local_backend()

    try:
        payload = backend.verify_token(token)
    except ValueError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc))

    if payload.get("op") != "upload":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token is not valid for upload")

    body = await request.body()
    if not body:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty upload body")

    content_type = payload.get("content_type", "application/octet-stream")
    s3_key = payload["key"]
    original_filename = s3_key.rsplit("/", 1)[-1]

    backend.write_file(s3_key, content_type, body, original_filename)

    return Response(status_code=status.HTTP_200_OK)


@router.get("/download/{token}")
async def download_from_local_storage(token: str):
    backend = _require_local_backend()

    try:
        payload = backend.verify_token(token)
    except ValueError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc))

    if payload.get("op") != "download":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token is not valid for download")

    try:
        data, content_type = backend.read_file(payload["key"])
    except FileNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found in local storage")

    return Response(content=data, media_type=content_type)