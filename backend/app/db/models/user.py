import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Enum,
    Index,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .candidate_profiles import CandidateProfile
    from .org_members import OrgMember
    from .oauth_account import OAuthAccount

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
    LOCAL = "local"              # retained for the existing DB enum type;
                                  # never used on oauth_accounts rows


class User(UUIDMixin, TimestampMixin, Base):
    """
    Central identity record. Role determines which part of the app they
    access.

    Design notes
    ------------
    - hashed_password is nullable to support OAuth-only sign-ups.
    - role is nullable: a brand-new OAuth signup has no role until they
      complete POST /auth/select-role. Local registration always supplies
      a role up front (see RegisterRequest), so this path never applies
      to local-only accounts.
    - is_active=False soft-deletes a user without breaking FK references.
    - OAuth linkage lives entirely in oauth_accounts now — see
      OAuthAccount. A user may have zero (local-only), one, or several
      linked provider accounts.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[Optional[UserRole]] = mapped_column(
        Enum(
            UserRole,
            name="user_role_enum",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=True,
    )

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Relationships
    candidate_profile: Mapped[Optional["CandidateProfile"]] = relationship(
        back_populates="user", uselist=False, lazy="select"
    )
    org_memberships: Mapped[List["OrgMember"]] = relationship(
        back_populates="user", lazy="select"
    )
    oauth_accounts: Mapped[List["OAuthAccount"]] = relationship(
        back_populates="user", lazy="select"
    )

    __table_args__ = (
        Index("ix_users_email", "email"),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"