"""
Application routes.

This module contains all API endpoints related to job applications.

Responsibilities:
- Candidate application lifecycle (apply, view, withdraw)
- Employer applicant listing
- Match score calculation

The implementation intentionally keeps route handlers thin by delegating
database operations to repository modules and business logic to services.
"""

# Types
import uuid
from typing import Annotated, List, Optional

# FastAPI and SQLAlchemy
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

# Auth and logging
from app.core.dependencies import CandidateUser, EmployerUser, get_db
from app.core.logging import logger

# Storage and functions
from app.storage import generate_presigned_download_url

# Database models
from app.db.models.application import Application, ApplicationStatus
from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.job import JobPosting, JobStatus
from app.db.models.resume_versions import ResumeVersion

# Repositories CRUD functions
from app.repositories import application_repo, job_repo, scenario_repo, pipeline_repo
from app.repositories.org_repo import get_org_for_user
from app.repositories.resume_repo import increment_override_usage

# Pydantic Schemas
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationWithJobResponse,
    EmployerApplicationResponse,
)
from app.schemas.resume import ResumeExtractionDetailResponse

# Services for business logic
from app.services.matching import compute_match_score
from app.services.resume_selection import resolve_resume_version
from app.services.override_quota import ensure_override_quota_current, is_unlimited

router = APIRouter(prefix="/applications", tags=["applications"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_candidate_profile(db: AsyncSession, user_id: uuid.UUID) -> CandidateProfile:
    """
    Retrieve the candidate profile for the authenticated user.

    Args:
        db: Active database session.
        user_id: Authenticated user's ID.

    Returns:
        CandidateProfile belonging to the user.

    Raises:
        HTTPException: If no candidate profile exists.
    """
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")
    return profile


def _build_with_job_response(
    app: Application, job: JobPosting, org
) -> ApplicationWithJobResponse:
    scenario_response = app.scenario_response
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
        scenario_enabled=job.scenario_enabled,
        scenario_score=scenario_response.score if scenario_response else None,
        scenario_ai_summary=None,  # employer-only — never surfaced to the candidate
        scenario_meets_threshold=(
            scenario_response.score >= job.scenario_score_threshold
            if scenario_response and scenario_response.score is not None
            else None
        ),
    )

def _score(job: JobPosting, resume_version: ResumeVersion) -> Optional[float]:
    """
    Compute the semantic match score between a resume and a job description.

    Returns None when embeddings are unavailable.
    """
    return compute_match_score(
        resume_version.embedding, job.jd_embedding,
        resume_version.categories, job.categories,
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
    """
    Submit a job application for the authenticated candidate.

    The workflow validates the job, resolves the resume version,
    calculates the match score, applies override rules when necessary,
    and creates (or restores) the application.
    """
    job = await job_repo.get_job(db, body.job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.PUBLISHED:
        raise HTTPException(400, "This job is not accepting applications")

    profile = await _get_candidate_profile(db, user.id)
    profile = await ensure_override_quota_current(db, profile)
    resume_version = await resolve_resume_version(db, profile, body.resume_version_id)

    existing = await application_repo.get_application_for_candidate_job(
        db, profile.id, body.job_id
    )
    if existing and existing.status != ApplicationStatus.WITHDRAWN:
        raise HTTPException(400, "You have already applied to this job")

    match_score = _score(job, resume_version)

    # Embeddings not ready yet (e.g. JD just published, embedding pipeline
    # hasn't run) — let the application through unscored rather than blocking.
    is_low_match = match_score is not None and match_score < job.match_threshold

    if is_low_match and not body.override:
        assert match_score is not None
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "low_match",
                "message": "...",
                "match_score": round(match_score, 3),
                "match_threshold": job.match_threshold,
                "overrides_remaining": max(
                    0, profile.override_apps_limit - profile.override_apps_used
                ),
                "overrides_unlimited": is_unlimited(profile.override_apps_limit),
            },
        )

    if is_low_match and body.override:
        if profile.override_apps_used >= profile.override_apps_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "override_quota_exceeded",
                    "message": "You've used all your override applications for this month.",
                },
            )
        await increment_override_usage(db, profile)

    if job.scenario_enabled:
        # Resume stage passed (or overridden) — gate on the scenario test next,
        # regardless of whether match_score was computable. The candidate still
        # needs to clear the scenario before moving further in the pipeline.
        resolved_status = ApplicationStatus.SCENARIO_PENDING
    elif match_score is None:
        resolved_status = ApplicationStatus.PENDING
    else:
        resolved_status = ApplicationStatus.RESUME_PASSED  # threshold met or override used

    if existing and existing.status == ApplicationStatus.WITHDRAWN:
        if job.scenario_enabled:
            await scenario_repo.delete_attempt_for_application(db, existing.id)
        existing.status = resolved_status.value  # type: ignore
        existing.resume_version_id = resume_version.id
        existing.match_score = match_score
        existing.is_override = is_low_match and body.override
        await db.commit()
        await db.refresh(existing)
        return existing

    application = await application_repo.create_application(
        db=db,
        job_id=body.job_id,
        candidate_id=profile.id,
        resume_version_id=resume_version.id,
        match_score=match_score,
        is_override=is_low_match and body.override,
        status=resolved_status,
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
            joinedload(Application.job_posting).joinedload(JobPosting.organization),
            joinedload(Application.scenario_response),
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

    result = await application_repo.withdraw_application(db, app)

    # If they were an active pipeline channel member (shortlisted or
    # further), remove them — same cleanup reject_application does.
    channel = await pipeline_repo.get_channel_by_job(db, app.job_id)
    if channel:
        await pipeline_repo.deactivate_member(db, channel.id, app.id)

    return result


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

    # if status is withdrawn or scenario pending, don't show the application to the employer
    filtered_rows = [
        (app, profile, user) for app, profile, user in rows
        if app.status not in (ApplicationStatus.WITHDRAWN, ApplicationStatus.SCENARIO_PENDING)
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

# ---------------------------------------------------------------------------
# Employer — view the candidate's resume for a specific application
# ---------------------------------------------------------------------------

async def _get_owned_application_for_employer(
    db: AsyncSession, application_id: uuid.UUID, user
) -> tuple[Application, JobPosting]:
    app = await application_repo.get_application_by_id(db, application_id)
    if not app:
        raise HTTPException(404, "Application not found")
    job = await job_repo.get_job(db, app.job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return app, job


@router.get(
    "/{application_id}/candidate-resume",
    response_model=ResumeExtractionDetailResponse,
)
async def get_candidate_resume(
    application_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Returns the structured extraction for the exact resume version locked
    at application time — not the candidate's current live resume, which
    may have changed since. Consistent with how match_score is computed
    and never recomputed.
    """
    app, _job = await _get_owned_application_for_employer(db, application_id, user)

    result = await db.execute(
        select(ResumeVersion).where(ResumeVersion.id == app.resume_version_id)
    )
    rv = result.scalar_one_or_none()
    if not rv:
        raise HTTPException(404, "Resume version not found")

    return ResumeExtractionDetailResponse(
        id=rv.id,
        version_number=rv.version_number,
        label=rv.label,
        categories=rv.categories,
        parsed_data=rv.parsed_data,
        has_embedding=rv.embedding is not None,
    )


@router.get("/{application_id}/candidate-resume/download-url")
async def get_candidate_resume_download_url(
    application_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Presigned GET URL to view/download the actual resume file (PDF/DOCX),
    not just the structured extraction."""
    app, _job = await _get_owned_application_for_employer(db, application_id, user)

    result = await db.execute(
        select(ResumeVersion).where(ResumeVersion.id == app.resume_version_id)
    )
    rv = result.scalar_one_or_none()
    if not rv:
        raise HTTPException(404, "Resume version not found")

    url = generate_presigned_download_url(rv.s3_key)
    return {"download_url": url, "expires_in_seconds": 900}