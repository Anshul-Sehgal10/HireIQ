from typing import Optional
from pydantic import BaseModel, Field
from app.db.models.org_invites import InviteDirection, InviteStatus
from app.db.models.org_members import OrgRole
from app.db.models.organization import VerificationStatus, SubscriptionTier


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------

class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    domain: Optional[str] = None


class OrgResponse(BaseModel):
    id: str
    name: str
    domain: Optional[str]
    verification_status: VerificationStatus
    subscription_tier: SubscriptionTier
    owner_id: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Org Member
# ---------------------------------------------------------------------------

class OrgMemberResponse(BaseModel):
    id: str
    user_id: str
    org_id: str
    role: OrgRole

    # Denormalised user fields — populated in the route
    email: Optional[str] = None
    full_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------

class InviteCreate(BaseModel):
    email: str = Field(description="Email address to invite")
    role: OrgRole = OrgRole.RECRUITER


class JoinRequestCreate(BaseModel):
    org_id: str = Field(description="ID of the organisation to request joining")


class InviteResponse(BaseModel):
    id: str
    org_id: str
    invited_email: str
    direction: InviteDirection
    status: InviteStatus
    role: OrgRole
    token: Optional[str] = None   # only exposed to the sender for copy-link UX

    model_config = {"from_attributes": True}