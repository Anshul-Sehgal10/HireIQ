"""
Resume upload routes.

POST /resumes/upload-url                  → get presigned PUT URL + create ResumeVersion row
POST /resumes/{resume_version_id}/confirm → mark upload done, set as active resume
GET  /resumes/                            → list all versions for the candidate
GET  /resumes/{resume_version_id}/download-url → presigned GET URL to view a resume
"""

import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger
from app.core.dependencies import CandidateUser, get_db
from app.db.models.candidate_profiles import CandidateProfile
from app.repositories import resume_repo
from app.services.resume_selection import resolve_resume_version
from app.schemas.resume import (
    ALLOWED_CONTENT_TYPES,
    PresignedUploadResponse,
    ResumeUploadRequest,
    ResumeVersionResponse,
    ResumeRenameRequest,
)
from app.storage import generate_presigned_download_url, generate_presigned_upload_url

router = APIRouter(prefix="/resumes", tags=["resumes"])


async def _get_candidate_profile(db: AsyncSession, user_id: uuid.UUID) -> CandidateProfile:
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")
    return profile


# ---------------------------------------------------------------------------
# Step 1 — get presigned upload URL
# ---------------------------------------------------------------------------

@router.post(
    "/upload-url",
    response_model=PresignedUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def get_upload_url(
    body: ResumeUploadRequest,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Creates a new (unconfirmed) ResumeVersion row and returns a presigned
    PUT URL. The frontend uploads the file directly to S3/R2 — it never
    passes through the backend server.

    After the PUT succeeds, call POST /resumes/{id}/confirm to activate it.
    """
    if body.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, "Only PDF and DOCX files are accepted.")

    profile = await _get_candidate_profile(db, user.id)
    version_number = await resume_repo.get_next_version_number(db, profile.id)

    # Sanitise filename: keep only alphanumerics, dots, hyphens, underscores
    safe_filename = (
        "".join(c for c in body.filename if c.isalnum() or c in ".-_") or "resume"
    )
    s3_key = f"resumes/{profile.id}/v{version_number}/{safe_filename}"

    rv = await resume_repo.create_resume_version(db, profile.id, s3_key, version_number)
    await db.commit()
    await db.refresh(rv)

    upload_url = generate_presigned_upload_url(s3_key, body.content_type)

    return PresignedUploadResponse(
        upload_url=upload_url,
        resume_version_id=rv.id,
        s3_key=s3_key,
        version_number=version_number,
    )


# ---------------------------------------------------------------------------
# Step 2 — confirm upload complete, activate as current resume
# ---------------------------------------------------------------------------

@router.post("/{resume_version_id}/confirm", response_model=ResumeVersionResponse)
async def confirm_upload(
    resume_version_id: uuid.UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Called after the frontend has successfully PUT the file to S3/R2.
    Sets this version as the candidate's active resume, unblocking the jobs feed.
    """
    profile = await _get_candidate_profile(db, user.id)
    rv = await resume_repo.get_resume_version(db, resume_version_id, profile.id)
    if not rv:
        raise HTTPException(404, "Resume version not found")

    await resume_repo.set_current_resume(
                                db, 
                                profile,
                                rv.id,
                                embedding=rv.embedding,
                                categories=rv.categories
                            )


    from app.storage import get_storage  # local import to avoid circulars, or move to top
    from app.services.resume_parser import extract_text
    from app.services.llm_extraction import extract_resume
    from app.services.embeddings import embed_text, structured_extraction_to_embedding_text

    storage = get_storage()  # ← see note below on read access
    try:
        file_bytes, content_type = storage.read_file(rv.s3_key)
        # read_file implemented in storage_backend
        raw_text = extract_text(file_bytes, content_type)
        if raw_text.strip():
            extraction = await extract_resume(raw_text)
            embedding_text = structured_extraction_to_embedding_text(extraction.model_dump())
            embedding = await embed_text(embedding_text)

            rv.parsed_data = extraction.model_dump(mode="json")
            rv.categories = [c.value for c in extraction.categories]
            rv.embedding = embedding
            
            profile.resume_embedding = embedding
            profile.categories = rv.categories  # ← new: keep the feed-filter cache in sync


            await db.commit()
            await db.refresh(rv)
    except Exception as exc:
        # Don't fail the upload if extraction/embedding fails — the resume is
        # still usable, it just won't have a match_score until this is retried.
        logger.error(f"Resume extraction/embedding failed for {rv.id}: {exc}")

    return ResumeVersionResponse(
        id=rv.id,
        candidate_id=rv.candidate_id,
        s3_key=rv.s3_key,
        version_number=rv.version_number,
        created_at=rv.created_at, # type: ignore
        label=rv.label,
        is_current=True,
    )


# ---------------------------------------------------------------------------
# List all resume versions
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[ResumeVersionResponse])
async def list_versions(
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Returns all resume versions for the candidate, newest first."""
    profile = await _get_candidate_profile(db, user.id)
    versions = await resume_repo.list_resume_versions(db, profile.id)
    current_id = profile.current_resume_version_id

    return [
        ResumeVersionResponse(
            id=rv.id,
            candidate_id=rv.candidate_id,
            s3_key=rv.s3_key,
            version_number=rv.version_number,
            label=rv.label,
            created_at=rv.created_at, # type: ignore
            is_current=(rv.id == current_id),
        )
        for rv in versions
    ]


# ---------------------------------------------------------------------------
# Presigned download URL (view/download a specific version)
# ---------------------------------------------------------------------------

@router.get("/{resume_version_id}/download-url")
async def get_download_url(
    resume_version_id: uuid.UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Returns a short-lived presigned GET URL for the candidate to view their resume."""
    profile = await _get_candidate_profile(db, user.id)
    rv = await resume_repo.get_resume_version(db, resume_version_id, profile.id)
    if not rv:
        raise HTTPException(404, "Resume version not found")

    url = generate_presigned_download_url(rv.s3_key)
    return {"download_url": url, "expires_in_seconds": 900}



@router.patch("/{resume_version_id}", response_model=ResumeVersionResponse)
async def rename(
    resume_version_id: uuid.UUID,
    body: ResumeRenameRequest,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _get_candidate_profile(db, user.id)
    rv = await resume_repo.get_resume_version(db, resume_version_id, profile.id)
    if not rv:
        raise HTTPException(404, "Resume version not found")
    rv = await resume_repo.rename_resume_version(db, rv, body.label)
    return ResumeVersionResponse(
        id=rv.id, candidate_id=rv.candidate_id, s3_key=rv.s3_key,
        version_number=rv.version_number, label=rv.label,
        created_at=rv.created_at,
        is_current=(rv.id == profile.current_resume_version_id),
    )


@router.post("/{resume_version_id}/set-current", response_model=ResumeVersionResponse)
async def set_current(
    resume_version_id: uuid.UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _get_candidate_profile(db, user.id)
    rv = await resume_repo.get_resume_version(db, resume_version_id, profile.id)
    if not rv:
        raise HTTPException(404, "Resume version not found")

    await resume_repo.set_current_resume(
        db, profile, rv.id, embedding=rv.embedding, categories=rv.categories
    )

    return ResumeVersionResponse(
        id=rv.id, candidate_id=rv.candidate_id, s3_key=rv.s3_key,
        version_number=rv.version_number, label=rv.label,
        created_at=rv.created_at, is_current=True,
    )


@router.delete("/{resume_version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    resume_version_id: uuid.UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _get_candidate_profile(db, user.id)
    rv = await resume_repo.get_resume_version(db, resume_version_id, profile.id)
    if not rv:
        raise HTTPException(404, "Resume version not found")

    if profile.current_resume_version_id == rv.id:
        raise HTTPException(
            400,
            "This is your active resume. Set a different version as active before deleting it.",
        )

    usage_count = await resume_repo.count_applications_for_resume_version(db, rv.id)
    if usage_count > 0:
        raise HTTPException(
            400,
            "This resume version was used in a submitted application and can't be deleted.",
        )

    from app.storage import delete_file
    try:
        delete_file(rv.s3_key)
    except Exception as exc:
        # Don't block DB cleanup on a storage hiccup — an orphaned S3 object
        # is recoverable later; an undeletable DB row is a worse UX bug.
        logger.warning(f"Failed to delete storage file for resume {rv.id}: {exc}")

    await resume_repo.delete_resume_version(db, rv)