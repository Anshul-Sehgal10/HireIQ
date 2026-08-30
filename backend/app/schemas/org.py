import uuid
from typing import List, Optional
from pydantic import BaseModel, Field
from app.db.models.job import JobLevel, WorkMode
from app.db.models.org_invites import InviteDirection, InviteStatus
from app.db.models.org_members import OrgRole
from app.db.models.organization import VerificationStatus, SubscriptionTier


class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    domain: Optional[str] = None


class OrgUpdate(BaseModel):
    """Owner-only profile edits. All fields optional — PATCH semantics,
    only fields the client actually sends are touched. Submitting an
    empty string clears a field; omitting it leaves it untouched."""
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    domain: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    website: Optional[str] = Field(default=None, max_length=255)
    industry: Optional[str] = Field(default=None, max_length=100)
    company_size: Optional[str] = Field(default=None, max_length=50)
    logo_url: Optional[str] = Field(default=None, max_length=500)


class OrgResponse(BaseModel):
    id: uuid.UUID
    name: str
    domain: Optional[str]
    verification_status: VerificationStatus
    subscription_tier: SubscriptionTier
    owner_id: uuid.UUID
    join_code: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    logo_url: Optional[str] = None

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


class JoinByCodeRequest(BaseModel):    
    code: str = Field(min_length=4, max_length=12)


class InviteResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    invited_email: str
    direction: InviteDirection
    status: InviteStatus
    role: OrgRole
    token: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Public org profile — candidate-facing (also usable by any authenticated
# role). No email addresses, no join code, no billing/subscription info —
# just what a candidate researching the company should see.
# ---------------------------------------------------------------------------

class OrgPublicJobResponse(BaseModel):
    id: uuid.UUID
    title: str
    location: Optional[str]
    work_mode: Optional[WorkMode]
    job_level: Optional[JobLevel]
    hiring_count: int
    salary_min: Optional[int]
    salary_max: Optional[int]
    scenario_enabled: bool

    model_config = {"from_attributes": True}


class OrgPublicMemberResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    role: OrgRole


class OrgPublicResponse(BaseModel):
    id: uuid.UUID
    name: str
    domain: Optional[str]
    description: Optional[str]
    website: Optional[str]
    industry: Optional[str]
    company_size: Optional[str]
    logo_url: Optional[str]
    verification_status: VerificationStatus
    member_count: int
    open_jobs: List[OrgPublicJobResponse]
    members: List[OrgPublicMemberResponse]