"""
Organisation management routes.

POST   /orgs/                          → create org (caller becomes OWNER)
GET    /orgs/mine                      → get caller's org
GET    /orgs/mine/members              → list members
DELETE /orgs/mine/members/{user_id}    → remove member (owner only)

POST   /orgs/invites/                  → send invite (owner/recruiter)
GET    /orgs/invites/                  → list outgoing pending invites
DELETE /orgs/invites/{invite_id}       → cancel invite

GET    /orgs/invites/incoming          → invites addressed to my email
POST   /orgs/invites/{token}/accept    → accept an invite
POST   /orgs/invites/{token}/decline   → decline an invite

POST   /orgs/{org_id}/requests/                      → request to join an org
GET    /orgs/mine/requests                            → owner sees pending requests
POST   /orgs/mine/requests/{request_id}/approve
POST   /orgs/mine/requests/{request_id}/reject
"""

import uuid
from datetime import datetime, timezone
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import CurrentUser, EmployerUser, get_db
from app.db.models.org_invites import InviteDirection, InviteStatus
from app.db.models.org_members import OrgRole
from app.db.models.user import User
from app.repositories import org_repo
from app.schemas.org import (
    InviteCreate,
    InviteResponse,
    JoinRequestCreate,
    OrgCreate,
    OrgMemberResponse,
    OrgResponse,
)

router = APIRouter(prefix="/orgs", tags=["orgs"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_owner(member):
    if not member or member.role != OrgRole.OWNER:
        raise HTTPException(status_code=403, detail="Only the org owner can do this")


# ---------------------------------------------------------------------------
# Org CRUD
# ---------------------------------------------------------------------------

@router.post("/", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
async def create_org(
    body: OrgCreate,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await org_repo.get_org_for_user(db, user.id)
    if existing:
        raise HTTPException(400, "You are already a member of an organisation")

    org = await org_repo.create_org(db, user.id, body.name, body.domain)
    return org


@router.get("/mine", response_model=OrgResponse)
async def get_my_org(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")
    return org


@router.get("/mine/members", response_model=List[OrgMemberResponse])
async def list_members(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")

    members = await org_repo.list_members(db, org.id)

    # Hydrate user fields
    result = []
    for m in members:
        u = await db.get(User, m.user_id)
        result.append(OrgMemberResponse(
            id=str(m.id),
            user_id=str(m.user_id),
            org_id=str(m.org_id),
            role=m.role,
            email=u.email if u else None,
            full_name=u.full_name if u else None,
        ))
    return result


@router.delete("/mine/members/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    target_user_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")

    membership = await org_repo.get_membership(db, user.id, org.id)
    _assert_owner(membership)

    if target_user_id == user.id:
        raise HTTPException(400, "Owner cannot remove themselves")

    removed = await org_repo.remove_member(db, org.id, target_user_id)
    if not removed:
        raise HTTPException(404, "Member not found")


# ---------------------------------------------------------------------------
# Invites (org → user)
# ---------------------------------------------------------------------------

@router.post("/invites/", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def send_invite(
    body: InviteCreate,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")

    membership = await org_repo.get_membership(db, user.id, org.id)
    if not membership or membership.role not in (OrgRole.OWNER, OrgRole.RECRUITER):
        raise HTTPException(403, "Only owners and recruiters can send invites")

    invite = await org_repo.create_invite(
        db, org.id, user.id, body.email, body.role
    )
    return invite


@router.get("/invites/", response_model=List[InviteResponse])
async def list_sent_invites(
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        return []
    return await org_repo.list_pending_invites(db, org.id)


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invite(
    invite_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")

    membership = await org_repo.get_membership(db, user.id, org.id)
    _assert_owner(membership)

    invite = await org_repo.get_invite_by_id(db, invite_id)
    if not invite or invite.org_id != org.id:
        raise HTTPException(404, "Invite not found")

    await org_repo.cancel_invite(db, invite)


# ---------------------------------------------------------------------------
# Incoming invites (user's inbox)
# ---------------------------------------------------------------------------

@router.get("/invites/incoming", response_model=List[InviteResponse])
async def incoming_invites(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await org_repo.list_invites_for_email(db, user.email)


@router.post("/invites/{token}/accept", response_model=OrgMemberResponse)
async def accept_invite(
    token: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check the user isn't already in an org
    existing = await org_repo.get_org_for_user(db, user.id)
    if existing:
        raise HTTPException(400, "You are already a member of an organisation")

    invite = await org_repo.get_invite_by_token(db, token)
    if not invite:
        raise HTTPException(404, "Invite not found or already used")

    if invite.status != InviteStatus.PENDING:
        raise HTTPException(400, f"Invite is {invite.status.value}")

    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(400, "This invite has expired")

    if invite.invited_email.lower() != user.email.lower():
        raise HTTPException(403, "This invite was sent to a different email address")

    member = await org_repo.accept_invite(db, invite, user.id)
    u = await db.get(User, member.user_id)
    return OrgMemberResponse(
        id=str(member.id),
        user_id=str(member.user_id),
        org_id=str(member.org_id),
        role=member.role,
        email=u.email if u else None,
        full_name=u.full_name if u else None,
    )


@router.post("/invites/{token}/decline", response_model=InviteResponse)
async def decline_invite(
    token: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invite = await org_repo.get_invite_by_token(db, token)
    if not invite:
        raise HTTPException(404, "Invite not found")

    if invite.invited_email.lower() != user.email.lower():
        raise HTTPException(403, "This invite was sent to a different email address")

    return await org_repo.decline_invite(db, invite)


# ---------------------------------------------------------------------------
# Join requests (user → org)
# ---------------------------------------------------------------------------

@router.post("/{org_id}/requests/", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def request_to_join(
    org_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await org_repo.get_org_for_user(db, user.id)
    if existing:
        raise HTTPException(400, "You are already a member of an organisation")

    org = await org_repo.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(404, "Organisation not found")

    req = await org_repo.create_join_request(db, org_id, user.id, user.email)
    return req


@router.get("/mine/requests", response_model=List[InviteResponse])
async def list_join_requests(
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        return []

    membership = await org_repo.get_membership(db, user.id, org.id)
    _assert_owner(membership)

    return await org_repo.list_pending_requests(db, org.id)


@router.post("/mine/requests/{request_id}/approve", response_model=OrgMemberResponse)
async def approve_request(
    request_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")

    membership = await org_repo.get_membership(db, user.id, org.id)
    _assert_owner(membership)

    req = await org_repo.get_invite_by_id(db, request_id)
    if not req or req.org_id != org.id or req.direction != InviteDirection.REQUEST:
        raise HTTPException(404, "Request not found")

    if req.status != InviteStatus.PENDING:
        raise HTTPException(400, f"Request is already {req.status.value}")

    member = await org_repo.approve_request(db, req)
    u = await db.get(User, member.user_id)
    return OrgMemberResponse(
        id=str(member.id),
        user_id=str(member.user_id),
        org_id=str(member.org_id),
        role=member.role,
        email=u.email if u else None,
        full_name=u.full_name if u else None,
    )


@router.post("/mine/requests/{request_id}/reject", response_model=InviteResponse)
async def reject_request(
    request_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")

    membership = await org_repo.get_membership(db, user.id, org.id)
    _assert_owner(membership)

    req = await org_repo.get_invite_by_id(db, request_id)
    if not req or req.org_id != org.id or req.direction != InviteDirection.REQUEST:
        raise HTTPException(404, "Request not found")

    return await org_repo.reject_request(db, req)