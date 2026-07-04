"""
Application repository — DB operations for the applications table.
"""

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.models.application import Application, ApplicationStatus
from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.job import JobPosting
from app.db.models.user import User


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


async def get_application_by_id(
    db: AsyncSession, application_id: uuid.UUID
) -> Optional[Application]:
    result = await db.execute(
        select(Application).where(Application.id == application_id)
    )
    return result.scalar_one_or_none()


async def get_application_for_candidate_job(
    db: AsyncSession, candidate_id: uuid.UUID, job_id: uuid.UUID
) -> Optional[Application]:
    """Check if a candidate already applied to a specific job."""
    result = await db.execute(
        select(Application).where(
            Application.candidate_id == candidate_id,
            Application.job_id == job_id,
        )
    )
    return result.scalar_one_or_none()


async def list_applications_by_candidate(
    db: AsyncSession, candidate_id: uuid.UUID
) -> List[Application]:
    """All applications for a candidate, newest first, with job + org eagerly loaded."""
    result = await db.execute(
        select(Application)
        .options(
            joinedload(Application.job_posting).joinedload(JobPosting.organization)
        )
        .where(Application.candidate_id == candidate_id)
        .order_by(Application.applied_at.desc())
    )
    return list(result.unique().scalars().all())


async def list_applications_by_job(
    db: AsyncSession, job_id: uuid.UUID
) -> List[tuple]:
    """
    All applications for a job posting (employer view).

    Returns a list of (Application, CandidateProfile, User) rows so the
    route can build EmployerApplicationResponse without N+1 queries.
    Ordered by match_score DESC (nulls last for when embeddings aren't run yet).
    """
    result = await db.execute(
        select(Application, CandidateProfile, User)
        .join(CandidateProfile, CandidateProfile.id == Application.candidate_id)
        .join(User, User.id == CandidateProfile.user_id)
        .where(Application.job_id == job_id)
        .order_by(Application.match_score.desc().nulls_last())
    )
    return list(result.all()) #type: ignore


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------


async def create_application(
    db: AsyncSession,
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    resume_version_id: uuid.UUID,
    match_score: Optional[float] = None,
    is_override: bool = False,
    status: ApplicationStatus = ApplicationStatus.PENDING,
) -> Application:
    application = Application(
        job_id=job_id,
        candidate_id=candidate_id,
        resume_version_id=resume_version_id,
        match_score=match_score,
        status=status.value,
        is_override=is_override,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    return application


async def update_application_status(
    db: AsyncSession, application: Application, status: ApplicationStatus
) -> Application:
    application.status = status
    await db.commit()
    await db.refresh(application)
    return application


async def withdraw_application(
    db: AsyncSession, application: Application
) -> Application:
    return await update_application_status(db, application, ApplicationStatus.WITHDRAWN)