"""
Candidate-facing aggregate routes — data that doesn't belong to any single
application (override quota, active resume summary, status breakdown) but
the candidate dashboard needs in one place rather than recomputing it
client-side from /applications/mine every load.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CandidateUser, get_db
from app.db.models.application import Application
from app.db.models.candidate_profiles import CandidateProfile
from app.schemas.candidate import CandidateOverviewResponse
from app.services.override_quota import ensure_override_quota_current, is_unlimited

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("/me/overview", response_model=CandidateOverviewResponse)
async def get_overview(
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")

    profile = await ensure_override_quota_current(db, profile)

    counts_result = await db.execute(
        select(Application.status, func.count())
        .where(Application.candidate_id == profile.id)
        .group_by(Application.status)
    )
    status_counts = {
        (s.value if hasattr(s, "value") else s): c for s, c in counts_result.all()
    }

    return CandidateOverviewResponse(
        has_resume=profile.current_resume_version_id is not None,
        resume_categories=profile.categories,
        subscription_tier=profile.subscription_tier,
        override_apps_used=profile.override_apps_used,
        override_apps_limit=profile.override_apps_limit,
        overrides_remaining=max(0, profile.override_apps_limit - profile.override_apps_used),
        total_applications=sum(status_counts.values()),
        status_counts=status_counts,
        overrides_unlimited=is_unlimited(profile.override_apps_limit),
    )