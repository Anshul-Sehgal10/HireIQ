"""
Org repository — DB operations for organizations, org_members, org_invites.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.org_invites import InviteDirection, InviteStatus, OrgInvite
from app.db.models.org_members import OrgMember, OrgRole
from app.db.models.organization import Organization


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------

async def create_org(
    db: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    domain: Optional[str] = None,
) -> Organization:
    org = Organization(owner_id=owner_id, name=name, domain=domain)
    db.add(org)
    await db.flush()  # get org.id before adding the member row

    member = OrgMember(org_id=org.id, user_id=owner_id, role=OrgRole.OWNER)
    db.add(member)

    await db.commit()
    await db.refresh(org)
    return org


async def get_org_by_id(db: AsyncSession, org_id: uuid.UUID) -> Optional[Organization]:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    return result.scalar_one_or_none()


async def get_org_for_user(db: AsyncSession, user_id: uuid.UUID) -> Optional[Organization]:
    result = await db.execute(
        select(Organization)
        .join(OrgMember, OrgMember.org_id == Organization.id)
        .where(OrgMember.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_membership(
    db: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID
) -> Optional[OrgMember]:
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.user_id == user_id,
            OrgMember.org_id == org_id,
        )
    )
    return result.scalar_one_or_none()


async def get_membership_for_user(
    db: AsyncSession, user_id: uuid.UUID
) -> Optional[OrgMember]:
    result = await db.execute(
        select(OrgMember).where(OrgMember.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_members(db: AsyncSession, org_id: uuid.UUID) -> List[OrgMember]:
    result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id)
    )
    return list(result.scalars().all())


async def remove_member(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    member = await get_membership(db, user_id, org_id)
    if not member:
        return False
    await db.delete(member)
    await db.commit()
    return True


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------

async def create_invite(
    db: AsyncSession,
    org_id: uuid.UUID,
    invited_by: uuid.UUID,
    invited_email: str,
    role: OrgRole = OrgRole.RECRUITER,
) -> OrgInvite:
    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    invite = OrgInvite(
        org_id=org_id,
        invited_by=invited_by,
        invited_email=invited_email.lower().strip(),
        direction=InviteDirection.INVITE,
        role=role,
        token=token,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


async def create_join_request(
    db: AsyncSession,
    org_id: uuid.UUID,
    requester_id: uuid.UUID,
    requester_email: str,
) -> OrgInvite:
    req = OrgInvite(
        org_id=org_id,
        invited_by=requester_id,
        invited_email=requester_email.lower().strip(),
        direction=InviteDirection.REQUEST,
        role=OrgRole.RECRUITER,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def get_invite_by_id(db: AsyncSession, invite_id: uuid.UUID) -> Optional[OrgInvite]:
    result = await db.execute(select(OrgInvite).where(OrgInvite.id == invite_id))
    return result.scalar_one_or_none()


async def get_invite_by_token(db: AsyncSession, token: str) -> Optional[OrgInvite]:
    result = await db.execute(select(OrgInvite).where(OrgInvite.token == token))
    return result.scalar_one_or_none()


async def list_pending_invites(db: AsyncSession, org_id: uuid.UUID) -> List[OrgInvite]:
    """Outgoing INVITE rows for the org (sent by owner/recruiter)."""
    result = await db.execute(
        select(OrgInvite).where(
            OrgInvite.org_id == org_id,
            OrgInvite.direction == InviteDirection.INVITE,
            OrgInvite.status == InviteStatus.PENDING,
        )
    )
    return list(result.scalars().all())


async def list_pending_requests(db: AsyncSession, org_id: uuid.UUID) -> List[OrgInvite]:
    """Incoming REQUEST rows — users asking to join."""
    result = await db.execute(
        select(OrgInvite).where(
            OrgInvite.org_id == org_id,
            OrgInvite.direction == InviteDirection.REQUEST,
            OrgInvite.status == InviteStatus.PENDING,
        )
    )
    return list(result.scalars().all())


async def list_invites_for_email(db: AsyncSession, email: str) -> List[OrgInvite]:
    """INVITE rows addressed to this email (user's inbox)."""
    result = await db.execute(
        select(OrgInvite).where(
            OrgInvite.invited_email == email.lower().strip(),
            OrgInvite.direction == InviteDirection.INVITE,
            OrgInvite.status == InviteStatus.PENDING,
        )
    )
    return list(result.scalars().all())


async def accept_invite(
    db: AsyncSession, invite: OrgInvite, user_id: uuid.UUID
) -> OrgMember:
    invite.status = InviteStatus.ACCEPTED
    invite.updated_at = datetime.now(timezone.utc)

    member = OrgMember(
        org_id=invite.org_id,
        user_id=user_id,
        role=invite.role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def decline_invite(db: AsyncSession, invite: OrgInvite) -> OrgInvite:
    invite.status = InviteStatus.DECLINED
    invite.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(invite)
    return invite


async def cancel_invite(db: AsyncSession, invite: OrgInvite) -> OrgInvite:
    invite.status = InviteStatus.CANCELLED
    invite.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(invite)
    return invite


async def approve_request(
    db: AsyncSession, request: OrgInvite
) -> OrgMember:
    request.status = InviteStatus.ACCEPTED
    request.updated_at = datetime.now(timezone.utc)

    member = OrgMember(
        org_id=request.org_id,
        user_id=request.invited_by,
        role=request.role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def reject_request(db: AsyncSession, request: OrgInvite) -> OrgInvite:
    request.status = InviteStatus.DECLINED
    request.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(request)
    return request