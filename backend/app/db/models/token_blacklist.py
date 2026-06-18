from sqlalchemy import DateTime, String, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDMixin
from datetime import datetime

class BlacklistedToken(UUIDMixin, Base):
    __tablename__ = "blacklisted_tokens"

    jti: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )  # so a cron job can prune expired rows

    __table_args__ = (
        Index("ix_blacklisted_tokens_jti", "jti"),
    )