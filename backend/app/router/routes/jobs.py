from typing import Annotated, List, Optional
from app.core.logging import logger
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CandidateUser, EmployerUser, get_db
from app.db.models.candidate_profiles import CandidateProfile
from app.repositories.job_repo import (
    close_job,
    create_job,
    get_job,
    list_jobs_by_org,
    list_published_jobs,
    publish_job,
    update_job,
    reprocess_job,
    get_job_with_org,
)
from app.repositories.org_repo import get_org_for_user

from app.schemas.job import JobCreate, JobResponse, JobUpdate, JobDetailResponse, JobExtractionDetailResponse
from app.schemas.matching import RelevanceCheckResponse

from app.services.matching import compute_match_score
from app.services.resume_selection import resolve_resume_version

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

    return await list_published_jobs(db, categories=profile.categories)


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_one(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await get_job_with_org(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = job.organization
    return JobDetailResponse(
        id=job.id, 
        org_id=job.org_id, 
        title=job.title, 
        description=job.description,
        status=job.status, 
        work_mode=job.work_mode, 
        job_level=job.job_level,
        location=job.location, 
        salary_min=job.salary_min, 
        salary_max=job.salary_max,
        hiring_count=job.hiring_count, 
        scenario_enabled=job.scenario_enabled,
        match_threshold=job.match_threshold, 
        categories=job.categories,
        org_name=org.name if org else "Unknown",
        org_domain=org.domain if org else None,
        org_verification_status=org.verification_status.value if org else "pending",
    )


@router.get("/{job_id}/relevance", response_model=RelevanceCheckResponse)
async def check_relevance(
    job_id: UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    resume_version_id: Optional[UUID] = None,
):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    result = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")

    resume_version = await resolve_resume_version(db, profile, resume_version_id)
    match_score = compute_match_score(
        resume_version.embedding, job.jd_embedding,
        resume_version.categories, job.categories,
    )
    meets_threshold = match_score is not None and match_score >= job.match_threshold

    return RelevanceCheckResponse(
        resume_version_id=resume_version.id,
        match_score=round(match_score, 4) if match_score is not None else None,
        match_threshold=job.match_threshold,
        meets_threshold=meets_threshold,
    )


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


@router.post("/{job_id}/reprocess", response_model=JobResponse)
async def reprocess(
    job_id: UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Re-runs JD extraction + embedding without unpublishing/republishing."""
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")

    job, success = await reprocess_job(db, job)
    if not success:
        raise HTTPException(422, "Reprocessing failed — check the LLM service configuration and try again.")
    return job


@router.get("/{job_id}/details", response_model=JobExtractionDetailResponse)
async def get_details(
    job_id: UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Returns the LLM's structured extraction + assigned categories for this
    job — scoped to the posting org, same as update/publish/close."""
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")

    return JobExtractionDetailResponse(
        id=job.id,
        title=job.title,
        categories=job.categories,
        parsed_data=job.parsed_data,
        has_embedding=job.jd_embedding is not None,
    )