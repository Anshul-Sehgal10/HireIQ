"""
Shared logic for resolving which resume version a candidate action
(apply, check-relevance) should use. Used by both the applications and
jobs routers, so it lives here instead of being duplicated in either.
"""

import uuid
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.resume_versions import ResumeVersion


async def resolve_resume_version(
    db: AsyncSession,
    profile: CandidateProfile,
    requested_version_id: Optional[uuid.UUID],
) -> ResumeVersion:
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

    if not profile.current_resume_version_id:
        raise HTTPException(
            400,
            "You must upload a resume before applying. Go to your profile to upload one.",
        )
    result = await db.execute(
        select(ResumeVersion).where(ResumeVersion.id == profile.current_resume_version_id)
    )
    rv = result.scalar_one_or_none()
    if not rv:
        raise HTTPException(400, "Active resume version not found — please re-upload your resume.")
    return rv