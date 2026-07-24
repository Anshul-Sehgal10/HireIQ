import enum
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .org_members import OrgMember
    from .org_invites import OrgInvite
    from .job import JobPosting


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    BLOCKED = "blocked"


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


class Organization(UUIDMixin, TimestampMixin, Base):
    """
    A verified employer / company tenant.
    """

    __tablename__ = "organizations"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verification_status: Mapped[VerificationStatus] = mapped_column(
    Enum(
        VerificationStatus,
        values_callable=lambda enum_cls: [e.value for e in enum_cls],
        name="verification_status_enum",
    ),
    nullable=False,
    default=VerificationStatus.PENDING,
    server_default="pending",
    )

    join_code: Mapped[Optional[str]] = mapped_column(
        String(12), unique=True, nullable=True, index=True
    )

    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
    Enum(
        SubscriptionTier,
        values_callable=lambda enum_cls: [e.value for e in enum_cls],
        name="org_subscription_tier_enum",
    ),
    nullable=False,
    default=SubscriptionTier.FREE,
    server_default=SubscriptionTier.FREE.value,
    )
    token_budget: Mapped[int] = mapped_column(Integer, default=100_000, server_default="100000")
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Relationships
    members: Mapped[List["OrgMember"]] = relationship(back_populates="organization", lazy="select")
    job_postings: Mapped[List["JobPosting"]] = relationship(back_populates="organization", lazy="select")
    invites: Mapped[List["OrgInvite"]] = relationship(back_populates="organization", lazy="select")

    __table_args__ = (
        Index("ix_organizations_owner_id", "owner_id"),
        Index("ix_organizations_domain", "domain"),
    )

    def __repr__(self) -> str:
        return f"<Organization id={self.id} name={self.name}>"