import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Enum,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from .organisation import Organization
    from .user import User


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class OrgRole(str, enum.Enum):
    OWNER = "owner"             # the person who signed the company up
    RECRUITER = "recruiter"     # can manage jobs and pipeline
    VIEWER = "viewer"           # read-only access to their org's pipeline

class OrgMember(UUIDMixin, Base):
    """
    Junction table: user ↔ organization with an org-scoped role.

    A user can be a member of at most one organization (enforced via
    unique constraint on user_id). If you ever want multi-org support,
    drop that constraint.
    """

    __tablename__ = "org_members"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[OrgRole] = mapped_column(
        Enum(OrgRole, name="org_role_enum"), nullable=False, default=OrgRole.RECRUITER
    )
    from sqlalchemy import DateTime, func
    joined_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="org_memberships")

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_org_members_user"),  # one org per user
        UniqueConstraint("org_id", "user_id", name="uq_org_members_org_user"),
        Index("ix_org_members_org_id", "org_id"),
        Index("ix_org_members_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<OrgMember user={self.user_id} org={self.org_id} role={self.role}>"