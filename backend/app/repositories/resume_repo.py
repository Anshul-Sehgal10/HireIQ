"""
Resume repository — DB operations for resume_versions and candidate_profiles.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.resume_versions import ResumeVersion


async def get_next_version_number(db: AsyncSession, candidate_id: uuid.UUID) -> int:
    """Returns max(version_number) + 1, or 1 if the candidate has no versions yet."""
    result = await db.execute(
        select(func.max(ResumeVersion.version_number)).where(
            ResumeVersion.candidate_id == candidate_id
        )
    )
    current_max = result.scalar_one_or_none()
    return (current_max or 0) + 1


async def create_resume_version(
    db: AsyncSession,
    candidate_id: uuid.UUID,
    s3_key: str,
    version_number: int,
) -> ResumeVersion:
    """Creates a new ResumeVersion row. Caller is responsible for committing."""
    rv = ResumeVersion(
        candidate_id=candidate_id,
        s3_key=s3_key,
        version_number=version_number,
    )
    db.add(rv)
    await db.flush()  # get rv.id; caller commits
    return rv


async def get_resume_version(
    db: AsyncSession,
    resume_version_id: uuid.UUID,
    candidate_id: uuid.UUID,
) -> Optional[ResumeVersion]:
    """Fetches a non-deleted version scoped to the candidate."""
    result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == resume_version_id,
            ResumeVersion.candidate_id == candidate_id,
            ResumeVersion.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def list_resume_versions(
    db: AsyncSession, candidate_id: uuid.UUID
) -> List[ResumeVersion]:
    """All non-deleted versions for a candidate, newest first."""
    result = await db.execute(
        select(ResumeVersion)
        .where(
            ResumeVersion.candidate_id == candidate_id,
            ResumeVersion.is_deleted.is_(False),
        )
        .order_by(ResumeVersion.version_number.desc())
    )
    return list(result.scalars().all())


async def set_current_resume(
    db: AsyncSession,
    profile: CandidateProfile,
    resume_version_id: uuid.UUID,
    embedding: Optional[list] = None,
    categories: Optional[list[str]] = None,
) -> CandidateProfile:
    profile.current_resume_version_id = resume_version_id
    profile.resume_updated_at = datetime.now(timezone.utc)
    if embedding is not None:
        profile.resume_embedding = embedding
    if categories is not None:
        profile.categories = categories
    await db.commit()
    await db.refresh(profile)
    return profile


async def increment_override_usage(db: AsyncSession, profile: CandidateProfile) -> CandidateProfile:
    """Increments the override_apps_used counter for a candidate."""
    profile.override_apps_used += 1
    await db.commit()
    await db.refresh(profile)
    return profile


async def rename_resume_version(db: AsyncSession, rv: ResumeVersion, label: str) -> ResumeVersion:
    rv.label = label.strip()[:255]
    await db.commit()
    await db.refresh(rv)
    return rv


async def count_applications_for_resume_version(
    db: AsyncSession, resume_version_id: uuid.UUID
) -> int:
    from sqlalchemy import func
    from app.db.models.application import Application
    result = await db.execute(
        select(func.count()).select_from(Application).where(
            Application.resume_version_id == resume_version_id
        )
    )
    return result.scalar_one()


async def delete_resume_version(db: AsyncSession, rv: ResumeVersion) -> None:
    await db.delete(rv)
    await db.commit()


async def soft_delete_resume_version(db: AsyncSession, rv: ResumeVersion) -> None:
    """
    Hides the resume from the candidate's own view without touching the row,
    the file in storage, or any Application.resume_version_id references.
    """
    rv.is_deleted = True
    await db.commit()