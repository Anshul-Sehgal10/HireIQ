"""
Import all models here so that:
1. Alembic's autogenerate can discover every table via Base.metadata.
2. Application code can do `from app.models import User, JobPosting, ...`
   without hunting through submodules.
"""

from .application import Application, ApplicationStatus
from app.db.base import Base
from .billing import AuditLog, TokenUsageLog
from .candidate_profiles import CandidateProfile
from .resume_versions import ResumeVersion
from .job import JobLevel, JobPosting, JobStatus, WorkMode
from .pipeline import ChannelMember, ChannelMessage, MessageType, PipelineChannel, PipelineStage
from .scenario import ScenarioQuestion, ScenarioResponse
from .organization import Organization, SubscriptionTier, VerificationStatus
from .org_members import OrgMember, OrgRole
from .user import (
    OAuthProvider,
    User,
    UserRole,
)

__all__ = [
    "Base",
    # Auth / Org
    "User",
    "UserRole",
    "OAuthProvider",
    "Organization",
    "VerificationStatus",
    "SubscriptionTier",
    "OrgMember",
    "OrgRole",
    # Candidate
    "CandidateProfile",
    "ResumeVersion",
    # Jobs
    "JobPosting",
    "JobStatus",
    "WorkMode",
    "JobLevel",
    # Applications
    "Application",
    "ApplicationStatus",
    # Scenario engine
    "ScenarioQuestion",
    "ScenarioResponse",
    # Pipeline / Chat
    "PipelineChannel",
    "PipelineStage",
    "ChannelMember",
    "ChannelMessage",
    "MessageType",
    # Observability & Billing
    "AuditLog",
    "TokenUsageLog",
]