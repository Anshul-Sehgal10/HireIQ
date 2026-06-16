# backend/app/repositories/org_repo.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.org_members import OrgMember
from app.db.models.organization import Organization
import uuid

async def get_org_for_user(db: AsyncSession, user_id: uuid.UUID):
    result = await db.execute(
        select(Organization)
        .join(OrgMember, OrgMember.org_id == Organization.id)
        .where(OrgMember.user_id == user_id)
    )
    return result.scalar_one_or_none()