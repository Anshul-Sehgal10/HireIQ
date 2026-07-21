import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.db.models.organization import SubscriptionTier, VerificationStatus
from app.db.models.user import OAuthProvider, UserRole


class ModerationActionRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class AdminOrgResponse(BaseModel):
    id: uuid.UUID
    name: str
    domain: Optional[str]
    verification_status: VerificationStatus
    subscription_tier: SubscriptionTier
    owner_id: uuid.UUID
    owner_email: Optional[str] = None
    member_count: int
    published_job_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    oauth_provider: OAuthProvider
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedOrgsResponse(BaseModel):
    items: List[AdminOrgResponse]
    total: int
    skip: int
    limit: int


class PaginatedUsersResponse(BaseModel):
    items: List[AdminUserResponse]
    total: int
    skip: int
    limit: int