import uuid
from typing import TYPE_CHECKING, List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from .candidate_profiles import CandidateProfile
    from .application import Application


class ResumeVersion(UUIDMixin, Base):
    """
    Immutable resume snapshot.

    Every time a candidate uploads a new resume, a new row is inserted.
    The version is NEVER mutated after creation. Applications reference a
    specific version_id so the employer always sees the exact resume that was
    semantically matched, even if the candidate later updates it.

    Design notes
    ------------
    - s3_key points to the raw file in S3/R2 (PDF or DOCX).
    - embedding is the 1536-dim vector for this specific version.
    - version_number increments per candidate (1, 2, 3, …).
    """

    __tablename__ = "resume_versions"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    embedding: Mapped[Optional[list]] = mapped_column(Vector(1536), nullable=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)

    parsed_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    categories: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String(50)), nullable=True)
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Candidate-facing soft delete. The row (and file) survives — an
    # Application.resume_version_id may still reference it, and the
    # employer must always be able to resolve "what did they apply with".
    # This flag only controls whether it shows up in the candidate's own
    # UI, freeing them to re-upload without the RESTRICT FK ever blocking them.
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    candidate_profile: Mapped["CandidateProfile"] = relationship(
        back_populates="resume_versions",
        foreign_keys=[candidate_id],
    )
    applications: Mapped[List["Application"]] = relationship(
        back_populates="resume_version", lazy="select"
    )

    __table_args__ = (
        UniqueConstraint("candidate_id", "version_number", name="uq_resume_version"),
        Index("ix_resume_versions_candidate_id", "candidate_id"),
        Index("ix_resume_versions_categories", "categories", postgresql_using="gin"),
        Index("ix_resume_versions_candidate_id_is_deleted", "candidate_id", "is_deleted"),
    )

    def __repr__(self) -> str:
        return f"<ResumeVersion candidate={self.candidate_id} v={self.version_number}>"