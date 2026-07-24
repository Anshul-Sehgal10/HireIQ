"""
OAuth account domain — one row per (provider, external account) linked to
a user. Split out of `users` so a single user can hold multiple provider
links (Google + LinkedIn, etc.) — the old uq_oauth_identity on users could
only express exactly one.
"""

import enum
import uuid

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from .user import OAuthProvider, User


class OAuthAccount(UUIDMixin, Base):
    """
    Design notes
    ------------
    - Unique on (provider, provider_account_id): the same external account
      can never be linked to two different users.
    - provider_email is stored for display/audit only — matching on login
      always goes through provider_account_id first, never email, once a
      link exists (see user_repo.upsert_oauth_user).
    - Reuses the existing `oauth_provider_enum` Postgres type (originally
      created for users.oauth_provider) — the LOCAL member on that type is
      never used for rows in this table, only GOOGLE/LINKEDIN are inserted.
    """

    __tablename__ = "oauth_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped["OAuthProvider"] = mapped_column(
        Enum(
            "google", "linkedin", "local",  # matches existing DB enum values
            name="oauth_provider_enum",
            create_type=False,
        ),
        nullable=False,
    )
    provider_account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_email: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="oauth_accounts")

    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_oauth_account_identity"),
        Index("ix_oauth_accounts_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<OAuthAccount user={self.user_id} provider={self.provider}>"