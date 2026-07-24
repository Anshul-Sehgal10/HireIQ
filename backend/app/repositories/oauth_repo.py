"""
OAuth account repository — DB operations for oauth_accounts.
"""

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.oauth_account import OAuthAccount
from app.db.models.user import OAuthProvider


async def get_by_provider_account(
    db: AsyncSession, provider: OAuthProvider, provider_account_id: str
) -> Optional[OAuthAccount]:
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_account_id == provider_account_id,
        )
    )
    return result.scalar_one_or_none()


async def list_for_user(db: AsyncSession, user_id: uuid.UUID) -> List[OAuthAccount]:
    result = await db.execute(select(OAuthAccount).where(OAuthAccount.user_id == user_id))
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    user_id: uuid.UUID,
    provider: OAuthProvider,
    provider_account_id: str,
    provider_email: str,
) -> OAuthAccount:
    account = OAuthAccount(
        user_id=user_id,
        provider=provider,
        provider_account_id=provider_account_id,
        provider_email=provider_email,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_by_id(db: AsyncSession, account_id: uuid.UUID) -> Optional[OAuthAccount]:
    result = await db.execute(select(OAuthAccount).where(OAuthAccount.id == account_id))
    return result.scalar_one_or_none()


async def delete(db: AsyncSession, account: OAuthAccount) -> None:
    await db.delete(account)
    await db.commit()