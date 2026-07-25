import uuid
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.org_message import OrgMessage


async def create_message(
    db: AsyncSession, org_id: uuid.UUID, sender_id: uuid.UUID, content: str
) -> OrgMessage:
    msg = OrgMessage(org_id=org_id, sender_id=sender_id, content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def list_messages(db: AsyncSession, org_id: uuid.UUID) -> List[OrgMessage]:
    result = await db.execute(
        select(OrgMessage).where(OrgMessage.org_id == org_id).order_by(OrgMessage.sent_at.asc())
    )
    return list(result.scalars().all())