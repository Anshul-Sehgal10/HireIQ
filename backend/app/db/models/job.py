"""
Job domain.

Tables
------
job_postings  — a single open role posted by a verified employer organisation.
"""

import uuid
from typing import TYPE_CHECKING, List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .application import Application
    from .billing import TokenUsageLog
    from .pipeline import PipelineChannel
    from .scenario import ScenarioQuestion
    from .organization import Organization


import enum


class JobStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    PAUSED = "paused"
    CLOSED = "closed"


class WorkMode(str, enum.Enum):
    REMOTE = "remote"
    ONSITE = "onsite"
    HYBRID = "hybrid"


class JobLevel(str, enum.Enum):
    INTERN = "intern"
    FRESHER = "fresher"         # 0-1 yr
    JUNIOR = "junior"           # 1-3 yr
    MID = "mid"                 # 3-6 yr
    SENIOR = "senior"           # 6+ yr
    LEAD = "lead"
    MANAGER = "manager"


class JobPosting(UUIDMixin, TimestampMixin, Base):
    """
    A role that an organisation wants to fill.

    Design notes
    ------------
    - jd_embedding is the 1536-dim vector of the full job description text.
      Used to compute cosine similarity against candidate resume embeddings.
    - match_threshold (0.0–1.0) is set per posting by the employer. Applications
      below this threshold are soft-blocked (requires override quota).
    - scenario_enabled lets employers opt individual postings into the
      Behavioral Scenario Engine without affecting others.
    - hiring_count is the target headcount; used in employer analytics.
    """

    __tablename__ = "job_postings"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    jd_embedding: Mapped[Optional[list]] = mapped_column(Vector(1536), nullable=True)

    status: Mapped[JobStatus] = mapped_column(
    Enum(
        JobStatus,
        values_callable=lambda enum_cls: [e.value for e in enum_cls],
        name="job_status_enum",
    ),
    nullable=False,
    default=JobStatus.DRAFT,
    server_default=JobStatus.DRAFT.value,
    )
    
    work_mode: Mapped[Optional[WorkMode]] = mapped_column(
        Enum(
            WorkMode,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="work_mode_enum",
        ),
        nullable=True,
    )
    
    job_level: Mapped[Optional[JobLevel]] = mapped_column(
        Enum(
            JobLevel,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            name="job_level_enum",
        ),
        nullable=True,
    )
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    salary_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hiring_count: Mapped[int] = mapped_column(Integer, default=1, server_default="1")

    # Scenario engine config
    scenario_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    # Cosine similarity threshold below which application is soft-blocked
    match_threshold: Mapped[float] = mapped_column(
        Float, default=0.65, server_default="0.65"
    )

    published_at: Mapped[Optional[object]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[object]] = mapped_column(DateTime(timezone=True), nullable=True)

    parsed_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    categories: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String(50)), nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="job_postings")
    applications: Mapped[List["Application"]] = relationship(
        back_populates="job_posting", lazy="select"
    )
    scenario_questions: Mapped[List["ScenarioQuestion"]] = relationship(
        back_populates="job_posting", lazy="select"
    )
    pipeline_channel: Mapped[Optional["PipelineChannel"]] = relationship(
        back_populates="job_posting", uselist=False, lazy="select"
    )
    token_usage_logs: Mapped[List["TokenUsageLog"]] = relationship(
        back_populates="job_posting", lazy="select"
    )

    __table_args__ = (
        # Most common query: all published jobs for a candidate's feed
        Index("ix_job_postings_status", "status"),
        # Tenant isolation: all jobs for an org
        Index("ix_job_postings_org_id", "org_id"),
        # Vector similarity search (IVFFlat, cosine)
        Index(
            "ix_job_postings_jd_embedding",
            "jd_embedding",
            postgresql_using="ivfflat",
            postgresql_ops={"jd_embedding": "vector_cosine_ops"},
            postgresql_with={"lists": 100},
        ),
        # Composite: active jobs by org (employer dashboard)
        Index("ix_job_postings_org_status", "org_id", "status"),

        Index("ix_job_postings_categories", "categories", postgresql_using="gin"),
    )

    def __repr__(self) -> str:
        return f"<JobPosting id={self.id} title={self.title!r} status={self.status}>"