"""
Org invite / join-request domain.
"""

import enum
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


class InviteDirection(str, enum.Enum):
    INVITE = "invite"
    REQUEST = "request"


class InviteStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


from app.db.models.org_members import OrgRole


class OrgInvite(UUIDMixin, Base):
    __tablename__ = "org_invites"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    invited_email: Mapped[str] = mapped_column(String(255), nullable=False)

    direction: Mapped[InviteDirection] = mapped_column(
        Enum(
            InviteDirection,
            values_callable=lambda e: [x.value for x in e],
            name="invite_direction_enum",
        ),
        nullable=False,
        default=InviteDirection.INVITE,
        server_default=InviteDirection.INVITE.value,
    )
    status: Mapped[InviteStatus] = mapped_column(
        Enum(
            InviteStatus,
            values_callable=lambda e: [x.value for x in e],
            name="invite_status_enum",
        ),
        nullable=False,
        default=InviteStatus.PENDING,
        server_default=InviteStatus.PENDING.value,
    )
    role: Mapped[OrgRole] = mapped_column(
        Enum(
            OrgRole,
            values_callable=lambda e: [x.value for x in e],
            name="org_role_enum",
            create_type=False,  # type already exists from org_members migration
        ),
        nullable=False,
        default=OrgRole.RECRUITER,
        server_default=OrgRole.RECRUITER.value,
    )

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

    organization: Mapped["Organization"] = relationship(
        back_populates="invites", lazy="select"
    )
    actor: Mapped["User"] = relationship(foreign_keys=[invited_by], lazy="select")

    __table_args__ = (
        Index("ix_org_invites_org_id", "org_id"),
        Index("ix_org_invites_invited_email", "invited_email"),
        Index("ix_org_invites_token", "token"),
    )

    def __repr__(self) -> str:
        return (
            f"<OrgInvite org={self.org_id} email={self.invited_email} "
            f"direction={self.direction} status={self.status}>"
        )