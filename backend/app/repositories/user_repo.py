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
    db: AsyncSession,
    provider: OAuthProvider,
    provider_id: str,
) -> Optional[User]:
    result = await db.execute(
        select(User).where(
            User.oauth_provider == provider,
            User.oauth_provider_id == provider_id,
        )
    )
    return result.scalar_one_or_none()


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


async def upsert_oauth_user(db: AsyncSession, data: dict) -> User:
    """
    Called after a successful OAuth callback.

    Priority order:
    1. Find by provider + provider_id  →  return as-is (returning user)
    2. Find by email                   →  link the OAuth account to existing user
    3. Neither found                   →  create a brand new CANDIDATE account
    """
    # 1. Exact OAuth match
    user = await get_user_by_oauth(db, data["oauth_provider"], data["oauth_provider_id"])
    if user:
        return user

    # 2. Email already exists (registered with password before)
    user = await get_user_by_email(db, data["email"])
    if user:
        user.oauth_provider = data["oauth_provider"]
        user.oauth_provider_id = data["oauth_provider_id"]
        if not user.full_name and data.get("full_name"):
            user.full_name = data["full_name"]
        await db.commit()
        await db.refresh(user)
        return user

    # 3. New user — default role is CANDIDATE; they can change later
    return await create_user(db, {
        "email": data["email"],
        "full_name": data.get("full_name", ""),
        "oauth_provider": data["oauth_provider"],
        "oauth_provider_id": data["oauth_provider_id"],
        "role": UserRole.CANDIDATE,
        "is_verified": True,   # OAuth providers already verified the email
    })


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