from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timezone
from app.db.models.token_blacklist import BlacklistedToken

async def blacklist_token(db: AsyncSession, jti: str, expires_at: datetime):
    entry = BlacklistedToken(jti=jti, expires_at=expires_at)
    db.add(entry)
    await db.commit()

async def is_blacklisted(db: AsyncSession, jti: str) -> bool:
    result = await db.execute(
        select(BlacklistedToken).where(BlacklistedToken.jti == jti)
    )
    return result.scalar_one_or_none() is not None

async def prune_expired(db: AsyncSession):
    await db.execute(
        delete(BlacklistedToken).where(
            BlacklistedToken.expires_at < datetime.now(timezone.utc)
        )
    )
    await db.commit()