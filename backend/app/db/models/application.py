"""
Application domain.

Tables
------
applications  — one row per candidate-per-job-posting. The central join
                between the candidate and employer worlds.
"""

import enum
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from .candidate_profiles import CandidateProfile, ResumeVersion
    from .job import JobPosting
    from .pipeline import ChannelMember
    from .scenario import ScenarioResponse, ScenarioQuestion


class ApplicationStatus(str, enum.Enum):
    PENDING = "pending"                 # submitted, awaiting resume screening result
    RESUME_REJECTED = "resume_rejected" # below match_threshold and no override used
    RESUME_PASSED = "resume_passed"     # above threshold, awaiting scenario (if enabled)
    SCENARIO_PENDING = "scenario_pending"
    SCENARIO_SUBMITTED = "scenario_submitted"
    SHORTLISTED = "shortlisted"         # moved to pipeline channel
    ASSESSMENT = "assessment"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"             # candidate withdrew


class Application(UUIDMixin, Base):
    """
    A candidate's application to a specific job posting.

    Design notes
    ------------
    - match_score is the cosine similarity (0–1) between the resume_version's
      embedding and the job's jd_embedding. Computed at apply-time and stored
      immutably. Never recomputed (the resume version is locked at submission).
    - is_override=True means the candidate burned one unit of their monthly
      override quota to apply despite a low match_score.
    - resume_version_id is locked at submission. If the candidate uploads a new
      resume after applying, this application still references the old version.
    - The unique constraint on (job_id, candidate_id) prevents duplicate applications.
    """

    __tablename__ = "applications"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        nullable=False,
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    resume_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resume_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )

    match_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(
            ApplicationStatus,
            name="application_status_enum",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
        default=ApplicationStatus.PENDING,
        server_default=ApplicationStatus.PENDING.value,
    )
    is_override: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )

    applied_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    job_posting: Mapped["JobPosting"] = relationship(back_populates="applications")
    candidate_profile: Mapped["CandidateProfile"] = relationship(back_populates="applications")
    resume_version: Mapped["ResumeVersion"] = relationship(back_populates="applications")
    scenario_response: Mapped[Optional["ScenarioResponse"]] = relationship(
        back_populates="application", uselist=False, lazy="select"
    )
    channel_member: Mapped[Optional["ChannelMember"]] = relationship(
        back_populates="application", uselist=False, lazy="select"
    )
    scenario_question: Mapped[Optional["ScenarioQuestion"]] = relationship(
    back_populates="application", uselist=False, lazy="select"
    )

    __table_args__ = (
        # One application per candidate per job
        UniqueConstraint("job_id", "candidate_id", name="uq_application_job_candidate"),
        # Employer dashboard: all applications for a job, sorted by match_score DESC
        Index("ix_applications_job_id_match_score", "job_id", "match_score"),
        # Candidate dashboard: all applications by a candidate
        Index("ix_applications_candidate_id", "candidate_id"),
        # Status filtering (shortlisted, rejected, etc.)
        Index("ix_applications_status", "status"),
    )

    def __repr__(self) -> str:
        score_str = f"{self.match_score:.2f}" if self.match_score is not None else "N/A"
        return f"<Application job={self.job_id} candidate={self.candidate_id} status={self.status} score={score_str}>"