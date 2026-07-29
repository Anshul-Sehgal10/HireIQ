"""
Admin moderation service — org verify/reject/block/unblock and user
block/unblock. Every action here writes an AuditLog row in the same
transaction as the state change — AuditLog existed in the schema
specifically for actions like these, but nothing wrote to it before this.

Design notes
------------
- Blocking an org (or rejecting a previously-VERIFIED one) force-closes
  every currently-published job under it — a blocked/rejected employer
  should not keep showing up in the candidate feed.
- Unblocking only restores verification_status to VERIFIED. Jobs that
  were closed at block time stay closed — the employer/admin must
  explicitly republish. Same "closed means closed, no silent
  resurrection" pattern used elsewhere (see pipeline_service's bulk
  stage advance, which never resurrects withdrawn/rejected applications).
- Admin accounts can't be blocked through block_user — prevents an
  admin from locking themselves or another admin out with no recovery
  path, since there's no separate super-admin tier in this system.
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job import JobPosting, JobStatus
from app.db.models.organization import Organization, VerificationStatus
from app.db.models.user import User, UserRole
from app.repositories import admin_repo, org_repo


async def _close_published_jobs(db: AsyncSession, org: Organization) -> int:
    result = await db.execute(
        select(JobPosting).where(
            JobPosting.org_id == org.id,
            JobPosting.status == JobStatus.PUBLISHED,
        )
    )
    jobs = list(result.scalars().all())
    for job in jobs:
        job.status = JobStatus.CLOSED
    return len(jobs)


async def _block_org_members(db: AsyncSession, org: Organization) -> list[uuid.UUID]:
    """
    Deactivates every member's User account, not just the org row. Skips
    accounts that are somehow already inactive (avoids clobbering an
    independent block reason) and skips ADMIN-role users defensively —
    org membership shouldn't include admins, but block_user() already
    forbids blocking admins through the individual endpoint, so this
    keeps both code paths consistent.
    """
    members = await org_repo.list_members(db, org.id)
    blocked_ids: list[uuid.UUID] = []
    for member in members:
        user = await db.get(User, member.user_id)
        if user and user.role != UserRole.ADMIN and user.is_active:
            user.is_active = False
            blocked_ids.append(user.id)
    return blocked_ids

# ---------------------------------------------------------------------------
# Organisation moderation
# ---------------------------------------------------------------------------

async def verify_org(
    db: AsyncSession, org: Organization, admin_id: uuid.UUID, reason: Optional[str] = None
) -> Organization:
    if org.verification_status == VerificationStatus.BLOCKED:
        raise ValueError("Unblock the organisation before verifying it")

    previous_status = org.verification_status.value
    org.verification_status = VerificationStatus.VERIFIED
    db.add(admin_repo.build_audit_log(
        admin_id, "org_verify", "organization", org.id,
        {"previous_status": previous_status, "reason": reason},
    ))
    await db.commit()
    await db.refresh(org)
    return org


async def reject_org(
    db: AsyncSession, org: Organization, admin_id: uuid.UUID, reason: Optional[str] = None
) -> Organization:
    if org.verification_status == VerificationStatus.BLOCKED:
        raise ValueError("Unblock the organisation before changing its verification status")

    was_verified = org.verification_status == VerificationStatus.VERIFIED
    previous_status = org.verification_status.value
    org.verification_status = VerificationStatus.REJECTED
    closed_count = await _close_published_jobs(db, org) if was_verified else 0

    db.add(admin_repo.build_audit_log(
        admin_id, "org_reject", "organization", org.id,
        {"previous_status": previous_status, "reason": reason, "jobs_closed": closed_count},
    ))
    await db.commit()
    await db.refresh(org)
    return org


async def block_org(
    db: AsyncSession, org: Organization, admin_id: uuid.UUID, reason: Optional[str] = None
) -> Organization:
    previous_status = org.verification_status.value
    org.verification_status = VerificationStatus.BLOCKED
    closed_count = await _close_published_jobs(db, org)
    blocked_member_ids = await _block_org_members(db, org)

    db.add(admin_repo.build_audit_log(
        admin_id, "org_block", "organization", org.id,
        {
            "previous_status": previous_status,
            "reason": reason,
            "jobs_closed": closed_count,
            "members_blocked": [str(i) for i in blocked_member_ids],
        },
    ))
    await db.commit()
    await db.refresh(org)
    return org


async def _unblock_org_members(db: AsyncSession, org: Organization) -> list[uuid.UUID]:
    """
    Reactivates every currently-inactive member on org unblock. This is
    intentionally blanket, mirroring _block_org_members being blanket on
    the way in — if an admin wants to keep one specific member blocked for
    an unrelated reason, they re-block that person individually afterward.
    """
    members = await org_repo.list_members(db, org.id)
    reactivated: list[uuid.UUID] = []
    for member in members:
        user = await db.get(User, member.user_id)
        if user and user.role != UserRole.ADMIN and not user.is_active:
            user.is_active = True
            reactivated.append(user.id)
    return reactivated


async def unblock_org(
    db: AsyncSession, org: Organization, admin_id: uuid.UUID, reason: Optional[str] = None
) -> Organization:
    if org.verification_status != VerificationStatus.BLOCKED:
        raise ValueError("Organisation is not currently blocked")

    org.verification_status = VerificationStatus.VERIFIED
    reactivated_ids = await _unblock_org_members(db, org)

    db.add(admin_repo.build_audit_log(
        admin_id, "org_unblock", "organization", org.id,
        {"reason": reason, "members_reactivated": [str(i) for i in reactivated_ids]},
    ))
    await db.commit()
    await db.refresh(org)
    return org


# ---------------------------------------------------------------------------
# User moderation
# ---------------------------------------------------------------------------

async def unblock_user(
    db: AsyncSession, target: User, admin_id: uuid.UUID, reason: Optional[str] = None
) -> User:
    if target.is_active:
        raise ValueError("User is not currently blocked")

    target.is_active = True
    db.add(admin_repo.build_audit_log(
        admin_id, "user_unblock", "user", target.id, {"reason": reason},
    ))
    await db.commit()
    await db.refresh(target)
    return target

async def _isolate_blocked_user(db: AsyncSession, target: User) -> dict:
    """
    Runs only on a direct, individual block (POST /admin/users/{id}/block) —
    never on the org-wide block path (block_org), which deliberately leaves
    membership/applications alone per the org-block design.

    - Employer: removed from their organisation's membership.
    - Candidate: every non-terminal application is withdrawn and any active
      pipeline channel membership tied to it is deactivated — identical
      cleanup to the candidate's own withdraw endpoint.

    Unblocking does NOT reverse this — the user must manually rejoin an
    org / reapply. That's intentional: "isolated" means isolated, not
    "paused."
    """
    from app.db.models.application import Application, ApplicationStatus
    from app.db.models.candidate_profiles import CandidateProfile
    from app.repositories import application_repo, pipeline_repo
    from sqlalchemy import select

    meta: dict = {}

    if target.role == UserRole.EMPLOYER:
        membership = await org_repo.get_membership_for_user(db, target.id)
        if membership:
            org_id = membership.org_id
            await org_repo.remove_member(db, org_id, target.id)
            meta["removed_from_org"] = str(org_id)

    elif target.role == UserRole.CANDIDATE:
        result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.user_id == target.id)
        )
        profile = result.scalar_one_or_none()
        if profile:
            terminal = {ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED}
            apps = await application_repo.list_applications_by_candidate(db, profile.id)
            withdrawn_ids = []
            for app in apps:
                if app.status in terminal:
                    continue
                await application_repo.update_application_status(
                    db, app, ApplicationStatus.WITHDRAWN
                )
                channel = await pipeline_repo.get_channel_by_job(db, app.job_id)
                if channel:
                    await pipeline_repo.deactivate_member(db, channel.id, app.id)
                withdrawn_ids.append(app.id)
            if withdrawn_ids:
                meta["applications_withdrawn"] = [str(i) for i in withdrawn_ids]

    return meta


async def block_user(
    db: AsyncSession, target: User, admin_id: uuid.UUID, reason: Optional[str] = None
) -> User:
    if target.role == UserRole.ADMIN:
        raise ValueError("Admin accounts cannot be blocked through this endpoint")
    if not target.is_active:
        raise ValueError("User is already blocked")

    target.is_active = False
    isolation_meta = await _isolate_blocked_user(db, target)

    db.add(admin_repo.build_audit_log(
        admin_id, "user_block", "user", target.id, {"reason": reason, **isolation_meta},
    ))
    await db.commit()
    await db.refresh(target)
    return target