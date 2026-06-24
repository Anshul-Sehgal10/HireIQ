"""
Application routes.

POST   /applications/                        → candidate applies to a job
GET    /applications/mine                    → candidate's own applications (with job info)
GET    /applications/{application_id}        → get single application
POST   /applications/{application_id}/withdraw → candidate withdraws
GET    /applications/job/{job_id}            → employer sees applicants for a job
"""

import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CandidateUser, EmployerUser, CurrentUser, get_db
from app.db.models.application import ApplicationStatus
from app.db.models.job import JobStatus
from app.repositories import application_repo, job_repo
from app.repositories.org_repo import get_org_for_user
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationWithJobResponse,
)

from sqlalchemy import select
from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.resume_versions import ResumeVersion

router = APIRouter(prefix="/applications", tags=["applications"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_candidate_profile(db: AsyncSession, user_id: uuid.UUID) -> CandidateProfile:
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")
    return profile


async def _get_or_create_placeholder_resume(
    db: AsyncSession, candidate_id: uuid.UUID
) -> ResumeVersion:
    """
    Temporary: return the candidate's current resume version, or create a
    placeholder if none exists yet (pre-upload phase).

    Once resume upload is built, this will be replaced by:
      if not profile.current_resume_version_id:
          raise HTTPException(400, "Please upload a resume before applying")
    """
    result = await db.execute(
        select(ResumeVersion)
        .where(ResumeVersion.candidate_id == candidate_id)
        .order_by(ResumeVersion.version_number.desc())
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    # Create a placeholder v1 resume so applications work before upload is built
    placeholder = ResumeVersion(
        candidate_id=candidate_id,
        s3_key="placeholder",
        version_number=1,
    )
    db.add(placeholder)
    await db.flush()
    return placeholder


def _build_with_job_response(app, job, org) -> ApplicationWithJobResponse:
    return ApplicationWithJobResponse(
        id=app.id,
        job_id=app.job_id,
        candidate_id=app.candidate_id,
        status=app.status,
        match_score=app.match_score,
        is_override=app.is_override,
        applied_at=app.applied_at,
        job_title=job.title,
        job_location=job.location,
        job_work_mode=job.work_mode,
        job_level=job.job_level,
        job_status=job.status,
        org_name=org.name if org else "Unknown",
    )


# ---------------------------------------------------------------------------
# Candidate — apply
# ---------------------------------------------------------------------------

@router.post("/", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply(
    body: ApplicationCreate,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # 1. Job must exist and be published
    job = await job_repo.get_job(db, body.job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.PUBLISHED:
        raise HTTPException(400, "This job is not accepting applications")

    # 2. Get candidate profile
    profile = await _get_candidate_profile(db, user.id)

    # 3. Check for duplicate application
    existing = await application_repo.get_application_for_candidate_job(
        db, profile.id, body.job_id
    )
    if existing:
        if existing.status == ApplicationStatus.WITHDRAWN:
            existing.status = ApplicationStatus.PENDING
            await db.commit()
            return existing
        raise HTTPException(400, "You have already applied to this job")

    # 4. Get or create a resume version (placeholder until upload is built)
    resume_version = await _get_or_create_placeholder_resume(db, profile.id)

    # 5. Create application (match_score is null until embedding pipeline runs)
    application = await application_repo.create_application(
        db=db,
        job_id=body.job_id,
        candidate_id=profile.id,
        resume_version_id=resume_version.id,
    )

    return application


# ---------------------------------------------------------------------------
# Candidate — list own applications
# ---------------------------------------------------------------------------

@router.get("/mine", response_model=List[ApplicationWithJobResponse])
async def list_mine(
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _get_candidate_profile(db, user.id)
    applications = await application_repo.list_applications_by_candidate(db, profile.id)

    result = []
    for app in applications:
        job = app.job_posting
        org = job.organization if job else None
        if job:
            result.append(_build_with_job_response(app, job, org))
    return result


# ---------------------------------------------------------------------------
# Candidate — get single application
# ---------------------------------------------------------------------------

@router.get("/mine/{application_id}", response_model=ApplicationWithJobResponse)
async def get_mine(
    application_id: uuid.UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _get_candidate_profile(db, user.id)
    app = await application_repo.get_application_by_id(db, application_id)

    if not app or app.candidate_id != profile.id:
        raise HTTPException(404, "Application not found")

    # Eagerly load job + org for the response
    from sqlalchemy.orm import joinedload
    from app.db.models.job import JobPosting
    from sqlalchemy import select as sa_select

    result = await db.execute(
        sa_select(Application)  # noqa: F821 — imported below
        .options(
            joinedload(Application.job_posting).joinedload(JobPosting.organization)
        )
        .where(Application.id == application_id)
    )
    app = result.unique().scalar_one_or_none()
    return _build_with_job_response(app, app.job_posting, app.job_posting.organization)


# ---------------------------------------------------------------------------
# Candidate — withdraw
# ---------------------------------------------------------------------------

@router.post("/{application_id}/withdraw", response_model=ApplicationResponse)
async def withdraw(
    application_id: uuid.UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _get_candidate_profile(db, user.id)
    app = await application_repo.get_application_by_id(db, application_id)

    if not app or app.candidate_id != profile.id:
        raise HTTPException(404, "Application not found")

    terminal = {ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED}
    if app.status in terminal:
        raise HTTPException(400, f"Application is already {app.status.value}")

    return await application_repo.withdraw_application(db, app)


# ---------------------------------------------------------------------------
# Employer — view applicants for a job
# ---------------------------------------------------------------------------

@router.get("/job/{job_id}", response_model=List[ApplicationResponse])
async def list_for_job(
    job_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await job_repo.get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")

    return await application_repo.list_applications_by_job(db, job_id)


# Fix missing import at module level
from app.db.models.application import Application  # noqa: E402