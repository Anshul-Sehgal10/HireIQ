from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CandidateUser, EmployerUser, get_db
from app.core.logging import logger
from app.db.models.candidate_profiles import CandidateProfile
from app.repositories.job_repo import (
    close_job,
    create_job,
    get_job,
    list_jobs_by_org,
    list_published_jobs,
    publish_job,
    update_job,
)
from app.repositories.org_repo import get_org_for_user
from app.schemas.job import JobCreate, JobResponse, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: JobCreate,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(400, "You must belong to an organisation before posting jobs")
    job = await create_job(db, org.id, user.id, body.model_dump())
    return job


@router.get("/mine", response_model=List[JobResponse])
async def list_mine(
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    logger.info("Fetching organisation for user %s", user.full_name)
    org = await get_org_for_user(db, user.id)
    if not org:
        return []
    return await list_jobs_by_org(db, org.id)


@router.get("/feed", response_model=List[JobResponse])
async def feed(
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Returns published jobs for the candidate feed.

    Requires the candidate to have an uploaded resume — if they don't,
    returns 403 with detail "resume_required" so the frontend can redirect
    them to the upload flow instead of showing a generic error.
    """
    # Gate: candidate must have uploaded a resume before browsing jobs
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.current_resume_version_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="resume_required",
        )

    return await list_published_jobs(db)


@router.get("/{job_id}", response_model=JobResponse)
async def get_one(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.patch("/{job_id}", response_model=JobResponse)
async def update(
    job_id: UUID,
    body: JobUpdate,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return await update_job(db, job, body.model_dump(exclude_none=True))


@router.post("/{job_id}/publish", response_model=JobResponse)
async def publish(
    job_id: UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return await publish_job(db, job)


@router.post("/{job_id}/close", response_model=JobResponse)
async def close(
    job_id: UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return await close_job(db, job)