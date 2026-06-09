import uuid
from typing import TYPE_CHECKING, List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from .organisation import SubscriptionTier

if TYPE_CHECKING:
    from .resume_versions import ResumeVersion
    from .application import Application
    from .user import User

class CandidateProfile(UUIDMixin, TimestampMixin, Base):
    """
    Extended profile for users with role=CANDIDATE.

    Design notes
    ------------
    - resume_embedding is a 1536-dim vector (OpenAI text-embedding-3-small).
      Stored here as a convenience cache; the canonical embedding lives on the
      ResumeVersion row. When the candidate uploads a new resume, both are updated.
    - override_apps_used / override_apps_limit enforce the monthly quota for
      applying to low-match jobs. Reset to 0 every billing cycle.
    - current_resume_version_id is a soft FK — nullable until first upload.
    """

    __tablename__ = "candidate_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Current active resume (denormalised pointer for fast matching)
    current_resume_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resume_versions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Embedding cache — synced from current_resume_version.embedding
    resume_embedding: Mapped[Optional[list]] = mapped_column(Vector(1536), nullable=True)

    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        String(50),
        nullable=False,
        default=SubscriptionTier.FREE.value,
        server_default=SubscriptionTier.FREE.value,
    )
    override_apps_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    override_apps_limit: Mapped[int] = mapped_column(Integer, default=10, server_default="10")

    resume_updated_at: Mapped[Optional[object]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="candidate_profile")
    resume_versions: Mapped[List["ResumeVersion"]] = relationship(
        back_populates="candidate_profile",
        foreign_keys="ResumeVersion.candidate_id",
        lazy="select",
    )
    applications: Mapped[List["Application"]] = relationship(
        back_populates="candidate_profile", lazy="select"
    )

    __table_args__ = (
        Index("ix_candidate_profiles_user_id", "user_id"),
        # pgvector IVFFlat index for cosine similarity search.
        # lists=100 is appropriate for < 1M rows; tune upward as data grows.
        Index(
            "ix_candidate_profiles_resume_embedding",
            "resume_embedding",
            postgresql_using="ivfflat",
            postgresql_ops={"resume_embedding": "vector_cosine_ops"},
            postgresql_with={"lists": 100},
        ),
    )

    def __repr__(self) -> str:
        return f"<CandidateProfile user={self.user_id} tier={self.subscription_tier}>"