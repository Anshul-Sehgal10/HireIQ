"""
Org invite / join-request domain.

A single table handles both directions:
  INVITE  — org owner/recruiter → target email
  REQUEST — employer user → org they want to join
"""

import enum
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.models.org_members import OrgRole

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


class InviteDirection(str, enum.Enum):
    INVITE = "invite"       # org → user
    REQUEST = "request"     # user → org


class InviteStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class OrgInvite(UUIDMixin, Base):
    """
    Unified invite / join-request record.

    For INVITE  rows: invited_by = org member who sent it, invited_email = target
    For REQUEST rows: invited_by = the requesting user,   invited_email = their own email
    """

    __tablename__ = "org_invites"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # The actor: sender for INVITE, requester for REQUEST
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    invited_email: Mapped[str] = mapped_column(String(255), nullable=False)

    direction: Mapped[InviteDirection] = mapped_column(
        Enum(InviteDirection, name="invite_direction_enum"),
        nullable=False,
        default=InviteDirection.INVITE,
    )
    status: Mapped[InviteStatus] = mapped_column(
        Enum(InviteStatus, name="invite_status_enum"),
        nullable=False,
        default=InviteStatus.PENDING,
        server_default=InviteStatus.PENDING.value,
    )
    role: Mapped[OrgRole] = mapped_column(
        Enum(OrgRole, name="org_role_enum"),
        nullable=False,
        default=OrgRole.RECRUITER,
    )

    # Secure token used in the accept URL — only for INVITE direction
    token: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)

    expires_at: Mapped[Optional[object]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="invites")
    actor: Mapped["User"] = relationship(foreign_keys=[invited_by])

    __table_args__ = (
        # Prevent duplicate pending invites to the same email in the same org
        UniqueConstraint(
            "org_id", "invited_email", "direction", "status",
            name="uq_org_invite_pending",
        ),
        Index("ix_org_invites_org_id", "org_id"),
        Index("ix_org_invites_invited_email", "invited_email"),
        Index("ix_org_invites_token", "token"),
    )

    def __repr__(self) -> str:
        return (
            f"<OrgInvite org={self.org_id} email={self.invited_email} "
            f"direction={self.direction} status={self.status}>"
        )