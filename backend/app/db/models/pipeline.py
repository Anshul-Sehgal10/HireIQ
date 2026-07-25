"""
Pipeline / Chat domain.

Tables
------
pipeline_channels  — one broadcast channel per job posting. Created when the
                     first candidate is shortlisted.
channel_members    — which applications (candidates) are currently in a channel.
channel_messages   — messages sent by employer or system into the channel.
"""

import enum
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from .application import Application
    from .job import JobPosting
    from .user import User


class PipelineStage(str, enum.Enum):
    SHORTLISTED = "shortlisted"
    ASSESSMENT = "assessment"
    INTERVIEW = "interview"
    OFFER = "offer"
    CLOSED = "closed"


class MessageType(str, enum.Enum):
    BROADCAST = "broadcast"     # employer → all active members
    DIRECT = "direct"           # employer → single candidate (private)
    SYSTEM = "system"           # auto-generated (e.g. "You have been shortlisted")


# ---------------------------------------------------------------------------
# pipeline_channels
# ---------------------------------------------------------------------------


class PipelineChannel(UUIDMixin, Base):
    """
    A per-job broadcast channel that replaces mass email.

    Design notes
    ------------
    - One channel per JobPosting (enforced by unique constraint on job_id).
    - stage tracks the current hiring phase. When the employer advances the
      stage, a SYSTEM message is auto-posted to the channel.
    - Members are added when shortlisted and removed (is_active=False) when
      rejected or the process concludes.
    """

    __tablename__ = "pipeline_channels"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    stage: Mapped[PipelineStage] = mapped_column(
        Enum(
            PipelineStage,
            values_callable=lambda e: [x.value for x in e],   # NEW
            name="pipeline_stage_enum",
        ),
        nullable=False,
        default=PipelineStage.SHORTLISTED,
        server_default=PipelineStage.SHORTLISTED.value,
    )
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    job_posting: Mapped["JobPosting"] = relationship(back_populates="pipeline_channel")
    members: Mapped[List["ChannelMember"]] = relationship(
        back_populates="channel", lazy="select"
    )
    messages: Mapped[List["ChannelMessage"]] = relationship(
        back_populates="channel", lazy="select"
    )

    __table_args__ = (
        Index("ix_pipeline_channels_job_id", "job_id"),
    )

    def __repr__(self) -> str:
        return f"<PipelineChannel job={self.job_id} stage={self.stage}>"


# ---------------------------------------------------------------------------
# channel_members
# ---------------------------------------------------------------------------


class ChannelMember(UUIDMixin, Base):
    """
    A candidate (via their application) that is currently in a pipeline channel.

    Design notes
    ------------
    - is_active=False means they were rejected or withdrew; they remain in the
      table for audit purposes but receive no further messages.
    - removed_at is set when is_active flips to False.
    - The unique constraint on (channel_id, application_id) prevents a candidate
      from being added to the same channel twice.
    """

    __tablename__ = "channel_members"

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_channels.id", ondelete="CASCADE"),
        nullable=False,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    joined_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    removed_at: Mapped[Optional[object]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    channel: Mapped["PipelineChannel"] = relationship(back_populates="members")
    application: Mapped["Application"] = relationship(back_populates="channel_member")

    __table_args__ = (
        UniqueConstraint(
            "channel_id", "application_id", name="uq_channel_member"
        ),
        # Fetch all active members of a channel (employer view)
        Index("ix_channel_members_channel_id_active", "channel_id", "is_active"),
        Index("ix_channel_members_application_id", "application_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<ChannelMember channel={self.channel_id} "
            f"application={self.application_id} active={self.is_active}>"
        )


# ---------------------------------------------------------------------------
# channel_messages
# ---------------------------------------------------------------------------


class ChannelMessage(UUIDMixin, Base):
    """
    A message posted into a pipeline channel.

    Design notes
    ------------
    - sender_id references users.id — can be an employer user or NULL for
      SYSTEM messages generated by the platform.
    - recipient_application_id is only set for DIRECT messages (employer → single
      candidate). For BROADCAST and SYSTEM it is NULL.
    - content is stored as plain text. The frontend may render it as Markdown
      but we store raw.
    """

    __tablename__ = "channel_messages"

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_channels.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # For DIRECT messages only
    recipient_application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
    )

    message_type: Mapped[MessageType] = mapped_column(
        Enum(
            MessageType,
            values_callable=lambda e: [x.value for x in e],   # NEW
            name="message_type_enum",
        ),
        nullable=False,
        default=MessageType.BROADCAST,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    sent_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    channel: Mapped["PipelineChannel"] = relationship(back_populates="messages")

    __table_args__ = (
        # Message history for a channel, chronological
        Index("ix_channel_messages_channel_id_sent_at", "channel_id", "sent_at"),
        # Fetch direct messages for a candidate
        Index(
            "ix_channel_messages_recipient",
            "recipient_application_id",
            postgresql_where="recipient_application_id IS NOT NULL",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<ChannelMessage channel={self.channel_id} type={self.message_type}>"
        )