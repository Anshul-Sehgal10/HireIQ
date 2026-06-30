"""
Application routes.

POST   /applications/                          → candidate applies to a job
GET    /applications/mine                      → candidate's own applications (with job info)
GET    /applications/mine/{application_id}     → single application (candidate)
POST   /applications/{application_id}/withdraw → candidate withdraws
GET    /applications/job/{job_id}              → employer sees applicants for a job
"""

import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.dependencies import CandidateUser, EmployerUser, get_db
from app.core.logging import logger
from app.db.models.application import Application, ApplicationStatus
from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.job import JobPosting, JobStatus
from app.db.models.resume_versions import ResumeVersion
from app.repositories import application_repo, job_repo
from app.repositories.org_repo import get_org_for_user
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationWithJobResponse,
    EmployerApplicationResponse,
)

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


async def _resolve_resume_version(
    db: AsyncSession,
    profile: CandidateProfile,
    requested_version_id: uuid.UUID | None,
) -> ResumeVersion:
    """
    Resolves which resume version to attach to an application.

    - If caller supplied a specific resume_version_id, validates it belongs
      to this candidate and uses it (allows applying with an older version).
    - Otherwise falls back to their current active version.
    - If no resume has ever been uploaded, raises 400.
    """
    if requested_version_id:
        result = await db.execute(
            select(ResumeVersion).where(
                ResumeVersion.id == requested_version_id,
                ResumeVersion.candidate_id == profile.id,
            )
        )
        rv = result.scalar_one_or_none()
        if not rv:
            raise HTTPException(404, "Resume version not found or does not belong to you")
        return rv

    # Fall back to current active resume
    if not profile.current_resume_version_id:
        raise HTTPException(
            400,
            "You must upload a resume before applying. "
            "Go to your profile to upload one.",
        )
    result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == profile.current_resume_version_id
        )
    )
    rv = result.scalar_one_or_none()
    if not rv:
        raise HTTPException(
            400,
            "Active resume version not found — please re-upload your resume.",
        )
    return rv


def _build_with_job_response(
    app: Application, job: JobPosting, org
) -> ApplicationWithJobResponse:
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

    # 3. Resolve which resume version to use — raises 400 if no resume uploaded
    resume_version = await _resolve_resume_version(db, profile, body.resume_version_id)

    # 4. Check for duplicate application
    existing = await application_repo.get_application_for_candidate_job(
        db, profile.id, body.job_id
    )
    if existing:
        if existing.status == ApplicationStatus.WITHDRAWN:
            # Allow re-apply: update resume version and reset to pending
            existing.status = ApplicationStatus.PENDING
            existing.resume_version_id = resume_version.id
            await db.commit()
            await db.refresh(existing)
            return existing
        raise HTTPException(400, "You have already applied to this job")

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

    result = await db.execute(
        select(Application)
        .options(
            joinedload(Application.job_posting).joinedload(JobPosting.organization)
        )
        .where(Application.id == application_id)
    )
    app = result.unique().scalar_one_or_none()

    if not app or app.candidate_id != profile.id:
        raise HTTPException(404, "Application not found")

    return _build_with_job_response(app, app.job_posting, app.job_posting.organization)  # type: ignore


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

@router.get("/job/{job_id}", response_model=List[EmployerApplicationResponse])
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

    # Returns list of Row(Application, CandidateProfile, User)
    rows = await application_repo.list_applications_by_job(db, job_id)

    # if status is withdrawn, don't show the application to the employer
    filtered_rows = [
        (app, profile, user) for app, profile, user in rows if app.status != ApplicationStatus.WITHDRAWN
    ]

    return [
        EmployerApplicationResponse(
            id=app.id,
            job_id=app.job_id,
            candidate_id=app.candidate_id,
            applicant_name=user_row.full_name,
            applicant_email=user_row.email,
            status=app.status,
            match_score=app.match_score,
            is_override=app.is_override,
            applied_at=app.applied_at,
            resume_version_id=app.resume_version_id,
        )
        for app, _profile_row, user_row in filtered_rows
    ]