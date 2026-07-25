"""
Org-wide internal chat domain — distinct from the per-job pipeline channel
in pipeline.py. No candidate ever sees this; it's purely internal to an
organisation's own members (e.g. coordinating who reviews which
candidate, sharing assessment links before posting them to a pipeline).
"""

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


class OrgMessage(UUIDMixin, Base):
    __tablename__ = "org_messages"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # SET NULL (not CASCADE) on delete — a message shouldn't vanish from
    # the team's history just because the author's account was later
    # removed; same pattern as ChannelMessage.sender_id.
    sender_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_org_messages_org_id_sent_at", "org_id", "sent_at"),
    )

    def __repr__(self) -> str:
        return f"<OrgMessage org={self.org_id} sender={self.sender_id}>"