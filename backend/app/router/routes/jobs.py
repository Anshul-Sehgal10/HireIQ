from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.core.categories import JobCategory
from app.core.pagination import encode_cursor
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

from app.schemas.job import (
    JobCreate, JobResponse, JobUpdate, JobDetailResponse,
    JobExtractionDetailResponse, JobFeedResponse,
)

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


@router.get("/meta/categories", response_model=List[str])
async def list_categories():
    return [c.value for c in JobCategory]


@router.get("/feed", response_model=JobFeedResponse)
async def feed(
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    cursor: Optional[str] = None,
    limit: int = Query(default=10, ge=1, le=50),
    categories: Optional[List[str]] = Query(default=None),
    q: Optional[str] = Query(default=None, max_length=200),
    location: Optional[str] = Query(default=None, max_length=255),
    salary_min: Optional[int] = Query(default=None, ge=0),
    salary_max: Optional[int] = Query(default=None, ge=0),
):
    """
    Paginated published-job feed. Category/location/salary/text filters are
    driven entirely by the query params — the frontend is responsible for
    seeding `categories` from the candidate's active resume on first load
    (via /candidates/me/overview) and updating it whenever that resume
    changes; this route applies whatever it's given with no fallback.
    """
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.current_resume_version_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="resume_required")

    if salary_min is not None and salary_max is not None and salary_min > salary_max:
        raise HTTPException(400, "salary_min cannot exceed salary_max")

    try:
        jobs, has_more = await list_published_jobs(
            db,
            categories=categories,
            cursor=cursor,
            limit=limit,
            q=q,
            location=location,
            salary_min=salary_min,
            salary_max=salary_max,
        )
    except ValueError:
        raise HTTPException(400, "Invalid pagination cursor")

    next_cursor = encode_cursor(jobs[-1].created_at, jobs[-1].id) if has_more and jobs else None
    return JobFeedResponse(jobs=jobs, next_cursor=next_cursor, has_more=has_more)  # type: ignore


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
        scenario_score_threshold=job.scenario_score_threshold,
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