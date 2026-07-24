"""
Admin moderation routes.

GET  /admin/orgs                      → list orgs (filter: verification_status, q)
POST /admin/orgs/{org_id}/verify
POST /admin/orgs/{org_id}/reject
POST /admin/orgs/{org_id}/block       → cascades: closes all published jobs
POST /admin/orgs/{org_id}/unblock     → restores VERIFIED; jobs stay closed

GET  /admin/users                     → list users (filter: role, is_active, q)
POST /admin/users/{user_id}/block     → is_active = False
POST /admin/users/{user_id}/unblock   → is_active = True
"""

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import AdminUser, get_db
from app.db.models.organization import Organization, VerificationStatus
from app.db.models.user import User, UserRole
from app.repositories import admin_repo
from app.repositories.org_repo import list_members as list_org_members_repo
from app.repositories.org_repo import get_org_by_id
from app.repositories.user_repo import get_user_by_id
from app.schemas.admin import (
    AdminOrgMemberResponse,
    AdminOrgResponse,
    AdminUserResponse,
    ModerationActionRequest,
    PaginatedOrgsResponse,
    PaginatedUsersResponse,
)
from app.services import admin_moderation

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_org_or_404(db: AsyncSession, org_id: UUID) -> Organization:
    org = await get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(404, "Organisation not found")
    return org


async def _to_admin_org_response(db: AsyncSession, org: Organization) -> AdminOrgResponse:
    owner = await db.get(User, org.owner_id)
    member_count = await admin_repo.count_members(db, org.id)
    published_count = await admin_repo.count_published_jobs(db, org.id)
    return AdminOrgResponse(
        id=org.id,
        name=org.name,
        domain=org.domain,
        verification_status=org.verification_status,
        subscription_tier=org.subscription_tier,
        owner_id=org.owner_id,
        owner_email=owner.email if owner else None,
        member_count=member_count,
        published_job_count=published_count,
        created_at=org.created_at,  # type: ignore
    )


# ---------------------------------------------------------------------------
# Organisations
# ---------------------------------------------------------------------------

@router.get("/orgs", response_model=PaginatedOrgsResponse)
async def list_orgs(
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    verification_status: Optional[VerificationStatus] = None,
    q: Optional[str] = Query(default=None, max_length=200),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    rows, total = await admin_repo.list_orgs(db, verification_status, q, skip, limit)
    return PaginatedOrgsResponse(
        items=[
            AdminOrgResponse(
                id=org.id,
                name=org.name,
                domain=org.domain,
                verification_status=org.verification_status,
                subscription_tier=org.subscription_tier,
                owner_id=org.owner_id,
                owner_email=owner_email,
                member_count=member_count,
                published_job_count=published_count,
                created_at=org.created_at,  # type: ignore
            )
            for org, member_count, published_count, owner_email in rows
        ],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/orgs/{org_id}/members", response_model=List[AdminOrgMemberResponse])
async def list_org_members(
    org_id: UUID,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await _get_org_or_404(db, org_id)
    members = await list_org_members_repo(db, org.id)
    result = []
    for m in members:
        u = await db.get(User, m.user_id)
        result.append(AdminOrgMemberResponse(
            id=m.id,
            user_id=m.user_id,
            role=m.role.value if hasattr(m.role, "value") else m.role,
            email=u.email if u else None,
            full_name=u.full_name if u else None,
            is_active=u.is_active if u else False,
        ))
    return result


@router.post("/orgs/{org_id}/verify", response_model=AdminOrgResponse)
async def verify_org(
    org_id: UUID,
    body: ModerationActionRequest,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await _get_org_or_404(db, org_id)
    try:
        org = await admin_moderation.verify_org(db, org, admin.id, body.reason)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return await _to_admin_org_response(db, org)


@router.post("/orgs/{org_id}/reject", response_model=AdminOrgResponse)
async def reject_org(
    org_id: UUID,
    body: ModerationActionRequest,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await _get_org_or_404(db, org_id)
    try:
        org = await admin_moderation.reject_org(db, org, admin.id, body.reason)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return await _to_admin_org_response(db, org)


@router.post("/orgs/{org_id}/block", response_model=AdminOrgResponse)
async def block_org(
    org_id: UUID,
    body: ModerationActionRequest,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await _get_org_or_404(db, org_id)
    org = await admin_moderation.block_org(db, org, admin.id, body.reason)
    return await _to_admin_org_response(db, org)


@router.post("/orgs/{org_id}/unblock", response_model=AdminOrgResponse)
async def unblock_org(
    org_id: UUID,
    body: ModerationActionRequest,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await _get_org_or_404(db, org_id)
    try:
        org = await admin_moderation.unblock_org(db, org, admin.id, body.reason)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return await _to_admin_org_response(db, org)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    q: Optional[str] = Query(default=None, max_length=200),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    users, total = await admin_repo.list_users(db, role, is_active, q, skip, limit)
    return PaginatedUsersResponse(
        items=[
            AdminUserResponse(
                id=u.id, email=u.email, full_name=u.full_name, role=u.role,
                is_active=u.is_active, is_verified=u.is_verified,
                has_password=u.hashed_password is not None,
                created_at=u.created_at,  # type: ignore
            )
            for u in users
        ],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("/users/{user_id}/block", response_model=AdminUserResponse)
async def block_user(
    user_id: UUID,
    body: ModerationActionRequest,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user_id == admin.id:
        raise HTTPException(400, "You cannot block your own account")
    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    try:
        target = await admin_moderation.block_user(db, target, admin.id, body.reason)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return target


@router.post("/users/{user_id}/unblock", response_model=AdminUserResponse)
async def unblock_user(
    user_id: UUID,
    body: ModerationActionRequest,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    try:
        target = await admin_moderation.unblock_user(db, target, admin.id, body.reason)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return target