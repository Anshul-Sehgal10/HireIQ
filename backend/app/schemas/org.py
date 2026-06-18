import uuid
from typing import Optional
from pydantic import BaseModel, Field
from app.db.models.org_invites import InviteDirection, InviteStatus
from app.db.models.org_members import OrgRole
from app.db.models.organization import VerificationStatus, SubscriptionTier


class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    domain: Optional[str] = None


class OrgResponse(BaseModel):
    id: uuid.UUID
    name: str
    domain: Optional[str]
    verification_status: VerificationStatus
    subscription_tier: SubscriptionTier
    owner_id: uuid.UUID

    model_config = {"from_attributes": True}


class OrgMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    org_id: uuid.UUID
    role: OrgRole
    email: Optional[str] = None
    full_name: Optional[str] = None

    model_config = {"from_attributes": True}


class InviteCreate(BaseModel):
    email: str = Field(description="Email address to invite")
    role: OrgRole = OrgRole.RECRUITER


class JoinRequestCreate(BaseModel):
    org_id: uuid.UUID


class InviteResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    invited_email: str
    direction: InviteDirection
    status: InviteStatus
    role: OrgRole
    token: Optional[str] = None

    model_config = {"from_attributes": True}