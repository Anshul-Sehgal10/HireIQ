"""
Observability & Billing domain.

Tables
------
audit_logs        — immutable record of every significant action on the platform.
token_usage_logs  — per-operation LLM token consumption, billed to organisations.
"""

import uuid
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .job import JobPosting


# ---------------------------------------------------------------------------
# audit_logs
# ---------------------------------------------------------------------------


class AuditLog(UUIDMixin, Base):
    """
    Append-only log of every significant platform action.

    Design notes
    ------------
    - Never updated or deleted — it's a ledger, not a mutable table.
    - actor_id may be NULL for system-generated actions.
    - resource_type + resource_id identify the affected entity (e.g.
      resource_type="application", resource_id=<uuid>).
    - metadata is a JSONB blob for action-specific context (e.g. old/new status
      for a status transition, IP address for a login event).
    - Used for compliance (who did what, when) and debugging.
    """

    __tablename__ = "audit_logs"

    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Admin: all actions by an actor
        Index("ix_audit_logs_actor_id", "actor_id"),
        # Compliance: all actions on a resource
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
        # Time-range queries
        Index("ix_audit_logs_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog action={self.action} resource={self.resource_type}"
            f":{self.resource_id}>"
        )


# ---------------------------------------------------------------------------
# token_usage_logs
# ---------------------------------------------------------------------------


class TokenUsageLog(UUIDMixin, Base):
    """
    Per-operation LLM token consumption, billed to the organisation.

    Design notes
    ------------
    - Every LLM call in the platform (scenario generation, resume evaluation,
      answer summarisation, JD quality check) writes one row here.
    - org_id is the billing target. tokens_used and cost_usd are summed on the
      employer's dashboard to show live spend.
    - operation identifies the LLM task (e.g. "scenario_generate",
      "resume_evaluate", "answer_summarise", "jd_quality_check").
    - job_id is nullable — some operations (e.g. platform-level analysis) are
      not tied to a specific posting.
    """

    __tablename__ = "token_usage_logs"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_postings.id", ondelete="SET NULL"),
        nullable=True,
    )
    operation: Mapped[str] = mapped_column(String(100), nullable=False)
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    job_posting: Mapped[Optional["JobPosting"]] = relationship(
        back_populates="token_usage_logs"
    )

    __table_args__ = (
        # Employer dashboard: total spend for an org, optionally by job
        Index("ix_token_usage_logs_org_id", "org_id"),
        Index("ix_token_usage_logs_org_id_job_id", "org_id", "job_id"),
        # Time-range billing queries
        Index("ix_token_usage_logs_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<TokenUsageLog org={self.org_id} op={self.operation} "
            f"tokens={self.tokens_used} cost=${self.cost_usd:.4f}>"
        )