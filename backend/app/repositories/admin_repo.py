"""
Admin repository — read queries for the moderation dashboard (org/user
listing) and a small audit-log builder shared by admin_moderation.py.

Kept separate from org_repo/user_repo since these are admin-only,
cross-tenant queries (no org/candidate scoping) — mixing them into the
tenant-scoped repos would make it easy to accidentally reuse an
unscoped query somewhere it shouldn't be.
"""

import uuid
from typing import List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.billing import AuditLog
from app.db.models.job import JobPosting, JobStatus
from app.db.models.org_members import OrgMember
from app.db.models.organization import Organization, VerificationStatus
from app.db.models.user import User, UserRole


def build_audit_log(
    actor_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID,
    meta_data: Optional[dict] = None,
) -> AuditLog:
    return AuditLog(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        meta_data=meta_data,
    )


async def list_orgs(
    db: AsyncSession,
    verification_status: Optional[VerificationStatus] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[List[tuple], int]:
    """Returns (rows, total) where each row is
    (Organization, member_count, published_job_count, owner_email)."""
    filters = []
    if verification_status:
        filters.append(Organization.verification_status == verification_status)
    if q:
        filters.append(Organization.name.ilike(f"%{q.strip()}%"))

    count_query = select(func.count()).select_from(Organization)
    if filters:
        count_query = count_query.where(and_(*filters))
    total = (await db.execute(count_query)).scalar_one()

    # Correlated scalar subqueries avoid an N+1 fan-out per org row.
    member_count_sq = (
        select(func.count(OrgMember.id))
        .where(OrgMember.org_id == Organization.id)
        .correlate(Organization)
        .scalar_subquery()
    )
    published_count_sq = (
        select(func.count(JobPosting.id))
        .where(
            JobPosting.org_id == Organization.id,
            JobPosting.status == JobStatus.PUBLISHED,
        )
        .correlate(Organization)
        .scalar_subquery()
    )

    query = (
        select(Organization, member_count_sq, published_count_sq, User.email)
        .join(User, User.id == Organization.owner_id)
        .order_by(Organization.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if filters:
        query = query.where(and_(*filters))

    result = await db.execute(query)
    return list(result.all()), total # type: ignore


async def list_users(
    db: AsyncSession,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[List[User], int]:
    filters = []
    if role:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active == is_active)
    if q:
        like = f"%{q.strip()}%"
        filters.append(or_(User.email.ilike(like), User.full_name.ilike(like)))

    count_query = select(func.count()).select_from(User)
    if filters:
        count_query = count_query.where(and_(*filters))
    total = (await db.execute(count_query)).scalar_one()

    query = select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    if filters:
        query = query.where(and_(*filters))
    users = list((await db.execute(query)).scalars().all())
    return users, total


async def count_members(db: AsyncSession, org_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(OrgMember).where(OrgMember.org_id == org_id)
    )
    return result.scalar_one()


async def count_published_jobs(db: AsyncSession, org_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(JobPosting).where(
            JobPosting.org_id == org_id, JobPosting.status == JobStatus.PUBLISHED,
        )
    )
    return result.scalar_one()