from typing import Optional
from pydantic import BaseModel


class CandidateOverviewResponse(BaseModel):
    has_resume: bool
    resume_categories: Optional[list[str]] = None
    subscription_tier: str
    override_apps_used: int
    override_apps_limit: int
    overrides_remaining: int
    total_applications: int
    status_counts: dict[str, int]
    overrides_unlimited: bool