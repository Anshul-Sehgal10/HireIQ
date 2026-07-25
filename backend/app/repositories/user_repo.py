"""
User repository — all DB operations for the users table and related lookups.

Every function here is async and accepts a SQLAlchemy AsyncSession.
Business logic lives in the service layer (not built yet);
this file only talks to the database.
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User, UserRole, OAuthProvider
from app.db.models.candidate_profiles import CandidateProfile
from app.repositories import oauth_repo


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


async def get_user_by_id(db: AsyncSession, user_id: str | uuid.UUID) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(
        select(User).where(User.email == email.lower().strip())
    )
    return result.scalar_one_or_none()


async def get_user_by_oauth(
    db: AsyncSession, provider: OAuthProvider, provider_account_id: str
) -> Optional[User]:
    """Resolves through oauth_accounts now, not a column on users."""
    account = await oauth_repo.get_by_provider_account(db, provider, provider_account_id)
    if not account:
        return None
    return await get_user_by_id(db, account.user_id)


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------


async def create_user(db: AsyncSession, data: dict) -> User:
    """
    Creates a user row and, if the role is CANDIDATE,
    auto-creates the candidate_profile row in the same transaction.
    """
    # Normalise email
    data["email"] = data["email"].lower().strip()

    user = User(**data)
    db.add(user)
    await db.flush()  # get user.id without committing yet

    if user.role == UserRole.CANDIDATE:
        profile = CandidateProfile(user_id=user.id)
        db.add(profile)

    await db.commit()
    await db.refresh(user)
    return user


async def find_existing_oauth_user(
    db: AsyncSession,
    provider: OAuthProvider,
    provider_account_id: str,
    email: str,
) -> Optional[User]:
    """
    Steps 1-2 of the OAuth algorithm only:
      1. Exact (provider, provider_account_id) match → return that user.
      2. Else, email match on an existing user → link this provider to
         them, return that user.
    Step 3 (genuinely new person) is intentionally NOT handled here —
    returns None instead, signaling the caller to route through the
    pending-token + role-selection flow rather than creating a role-less
    row. See create_oauth_pending_token / POST /auth/select-role.
    """
    email = email.lower().strip()

    existing_account = await oauth_repo.get_by_provider_account(db, provider, provider_account_id)
    if existing_account:
        return await get_user_by_id(db, existing_account.user_id)

    user = await get_user_by_email(db, email)
    if user:
        await oauth_repo.create(db, user.id, provider, provider_account_id, email)
        return user

    return None


async def update_user(
    db: AsyncSession, user_id: uuid.UUID, updates: dict
) -> Optional[User]:
    user = await get_user_by_id(db, user_id)
    if not user:
        return None
    for key, value in updates.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


async def deactivate_user(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    """Soft-delete: sets is_active=False. Never hard-deletes."""
    return await update_user(db, user_id, {"is_active": False})