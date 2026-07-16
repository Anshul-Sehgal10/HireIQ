"""
Monthly override quota — lazy reset (no scheduler in this stack).

Any route that reads or consumes override_apps_used/limit should call
ensure_override_quota_current() on the profile first, so a stale counter
from a previous month never blocks (or over-permits) a candidate.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.organization import SubscriptionTier

UNLIMITED_OVERRIDES = 999_999

OVERRIDE_LIMITS_BY_TIER: dict[str, int] = {
    SubscriptionTier.FREE.value: 10,
    SubscriptionTier.PRO.value: 30,
    SubscriptionTier.PREMIUM.value: UNLIMITED_OVERRIDES,
    SubscriptionTier.ENTERPRISE.value: UNLIMITED_OVERRIDES,
}
DEFAULT_OVERRIDE_LIMIT = 10


def is_unlimited(limit: int) -> bool:
    return limit >= UNLIMITED_OVERRIDES


def _period_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


async def ensure_override_quota_current(
    db: AsyncSession, profile: CandidateProfile
) -> CandidateProfile:
    now = datetime.now(timezone.utc)
    last_reset: Optional[datetime] = profile.override_apps_reset_at #type: ignore
    needs_reset = last_reset is None or _period_key(last_reset) != _period_key(now)

    tier_limit = OVERRIDE_LIMITS_BY_TIER.get(profile.subscription_tier, DEFAULT_OVERRIDE_LIMIT)
    limit_stale = profile.override_apps_limit != tier_limit

    if not needs_reset and not limit_stale:
        return profile

    if needs_reset:
        profile.override_apps_used = 0
        profile.override_apps_reset_at = now
    if limit_stale:
        profile.override_apps_limit = tier_limit

    await db.commit()
    await db.refresh(profile)
    return profile