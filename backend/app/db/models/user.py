import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Enum,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .candidate_profiles import CandidateProfile
    from .org_members import OrgMember

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYER = "employer"       # generic employer staff account
    CANDIDATE = "candidate"


class OAuthProvider(str, enum.Enum):
    GOOGLE = "google"
    LINKEDIN = "linkedin"
    LOCAL = "local"             # email + password



class User(UUIDMixin, TimestampMixin, Base):
    """
    Central identity record. Role determines which part of the app they access.

    Design notes
    ------------
    - hashed_password is nullable to support OAuth-only sign-ups.
    - oauth_provider + oauth_provider_id are unique together so the same
      Google account can't create two users.
    - is_active=False soft-deletes a user without breaking FK references.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role_enum",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
    )

    # OAuth
    oauth_provider: Mapped[OAuthProvider] = mapped_column(
        Enum(
            OAuthProvider,
            name="oauth_provider_enum",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
        default=OAuthProvider.LOCAL,
        server_default=OAuthProvider.LOCAL.value,
    )
    oauth_provider_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Relationships
    candidate_profile: Mapped[Optional["CandidateProfile"]] = relationship(
        back_populates="user", uselist=False, lazy="select"
    )
    org_memberships: Mapped[List["OrgMember"]] = relationship(
        back_populates="user", lazy="select"
    )

    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_provider_id", name="uq_oauth_identity"),
        # Fast lookup by email (login)
        Index("ix_users_email", "email"),
        # Fast lookup by provider id (OAuth callback)
        Index("ix_users_oauth_provider_id", "oauth_provider", "oauth_provider_id"),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"