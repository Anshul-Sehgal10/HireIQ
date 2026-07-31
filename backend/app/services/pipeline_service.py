"""
Pipeline service — business logic for shortlist/reject, stage advancement,
and channel messaging. Sits between the routes (router/routes/pipeline.py,
router/routes/ws_pipeline.py) and the two repos it touches (pipeline_repo,
application_repo).

Design notes
------------
- Every mutating action here also drops a SYSTEM message into the channel
  so the audit trail ("why did my status change") lives in the same place
  the candidate/employer already look — the channel — rather than a
  separate audit table they'd never see. EXCEPTION: shortlisting a single
  candidate no longer writes a persisted message — see shortlist_application.
- Application status transitions driven by pipeline stage advancement are
  intentionally narrow: only forward pipeline stages (shortlisted →
  assessment → interview → offer) map onto ApplicationStatus values.
  PipelineStage.CLOSED has no ApplicationStatus equivalent — closing the
  channel just deactivates membership (process concluded) without
  rewriting whatever terminal-ish status each application already has.
- Withdrawn/rejected applications are always skipped during bulk stage
  advancement — a candidate who withdrew mid-pipeline should never be
  silently resurrected by an unrelated "advance everyone" action.
- Every function that mutates the channel also pushes the change live to
  connected WebSockets (see ws_pipeline.py) so REST callers and WS callers
  both result in real-time updates for everyone in the room — one code
  path, not two.
"""

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ws_manager import ConnectionInfo, pipeline_chat_manager
from app.db.models.application import Application, ApplicationStatus
from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.job import JobPosting
from app.db.models.pipeline import ChannelMessage, MessageType, PipelineChannel, PipelineStage
from app.db.models.user import User
from app.repositories import application_repo, pipeline_repo
from app.schemas.pipeline import ChannelMessageResponse

# Forward-stage mapping only. CLOSED is deliberately absent — see module
# docstring. If PipelineStage ever grows a stage without a matching
# ApplicationStatus value, it should be omitted here too rather than
# guessed at.
STAGE_TO_APPLICATION_STATUS: dict[PipelineStage, ApplicationStatus] = {
    PipelineStage.SHORTLISTED: ApplicationStatus.SHORTLISTED,
    PipelineStage.ASSESSMENT: ApplicationStatus.ASSESSMENT,
    PipelineStage.INTERVIEW: ApplicationStatus.INTERVIEW,
    PipelineStage.OFFER: ApplicationStatus.OFFER,
}

# Applications in these statuses are never touched by bulk pipeline actions.
_TERMINAL_STATUSES = {ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _candidate_display_name(db: AsyncSession, application: Application) -> str:
    """
    Resolves a candidate's display name for system messages via db.get()
    rather than relationship lazy-loading — application objects passed in
    here often weren't fetched with joinedload, and lazy="select" access
    on an async session outside a load context raises MissingGreenlet.
    """
    cp = await db.get(CandidateProfile, application.candidate_id)
    if not cp:
        return "A candidate"
    u = await db.get(User, cp.user_id)
    return u.full_name if u else "A candidate"


def _room_id(channel_id: uuid.UUID) -> str:
    return f"pipeline:{channel_id}"


def _visible_to(info: ConnectionInfo, message: ChannelMessage) -> bool:
    """
    Employer/admin sockets see everything. Candidate sockets only see
    BROADCAST/SYSTEM messages plus DIRECT messages addressed specifically
    to their own application — mirrors pipeline_repo.list_messages_for_candidate.
    """
    if info.role in ("employer", "admin"):
        return True
    if message.message_type in (MessageType.BROADCAST, MessageType.SYSTEM):
        return True
    return (
        message.recipient_application_id is not None
        and str(message.recipient_application_id) == info.extra.get("application_id")
    )


async def _push_message(channel_id: uuid.UUID, message: ChannelMessage) -> None:
    """Pushes a persisted message live to every connection allowed to see it."""
    payload = ChannelMessageResponse.model_validate(message).model_dump(mode="json")
    await pipeline_chat_manager.broadcast_selective(
        _room_id(channel_id),
        lambda info: {"type": "message", "data": payload} if _visible_to(info, message) else None,
    )


async def _push_activity(channel_id: uuid.UUID, text: str) -> None:
    """
    Ephemeral, non-persisted live notice — NOT stored in channel_messages
    and NOT shown again after a page reload. Used for high-frequency,
    low-signal events (see shortlist_application) that would otherwise
    drown out real conversation if written as permanent SYSTEM messages.
    """
    await pipeline_chat_manager.broadcast(_room_id(channel_id), {"type": "activity", "message": text})


# ---------------------------------------------------------------------------
# Employer — shortlist / reject
# ---------------------------------------------------------------------------

async def shortlist_application(
    db: AsyncSession, job: JobPosting, application: Application
) -> PipelineChannel:
    """
    Moves an application into the job's pipeline channel. Creates the
    channel on first shortlist for this job. Idempotent — shortlisting an
    already-active member just reaffirms membership rather than erroring.

    Deliberately does NOT write a persisted SYSTEM chat message. Employers
    often shortlist many candidates back-to-back in one session; a stored
    channel message on every single one buried real conversation under
    "X has been shortlisted" spam (reported in TODO.md). A live-only
    "activity" toast is pushed instead — visible to whoever's watching
    right now, gone on reload, never part of the message history.
    """
    if application.status == ApplicationStatus.WITHDRAWN:
        raise ValueError("Cannot shortlist a withdrawn application")

    channel = await pipeline_repo.get_or_create_channel(db, job.id)
    await pipeline_repo.add_member(db, channel.id, application.id)
    await application_repo.update_application_status(
        db, application, ApplicationStatus.SHORTLISTED
    )

    name = await _candidate_display_name(db, application)
    await _push_activity(channel.id, f"{name} has been shortlisted.")
    return channel


async def reject_application(
    db: AsyncSession, job: JobPosting, application: Application
) -> None:
    """
    Rejects an application. If it was a pipeline member, removes them from
    the channel (is_active=False) and posts a system note. Rejecting an
    application that was never shortlisted (still just in the applicant
    list) is also valid — it simply won't touch any channel.
    """
    if application.status == ApplicationStatus.WITHDRAWN:
        raise ValueError("Cannot reject a withdrawn application")

    await application_repo.update_application_status(
        db, application, ApplicationStatus.REJECTED
    )

    channel = await pipeline_repo.get_channel_by_job(db, job.id)
    if not channel:
        return

    member = await pipeline_repo.deactivate_member(db, channel.id, application.id)
    if member is None:
        return  # was never a pipeline member — nothing more to do

    name = await _candidate_display_name(db, application)
    message = await pipeline_repo.create_message(
        db, channel.id, MessageType.SYSTEM, f"{name} has been rejected and removed from the pipeline.",
    )
    await _push_message(channel.id, message)


# ---------------------------------------------------------------------------
# Employer — bulk stage advance
# ---------------------------------------------------------------------------

async def advance_stage(
    db: AsyncSession, job: JobPosting, stage: PipelineStage
) -> PipelineChannel:
    """
    Bulk-moves every active pipeline member forward to `stage` and posts a
    single SYSTEM broadcast. Withdrawn/rejected applications are skipped
    even if their channel membership row is (stalely) still active.

    Advancing to CLOSED deactivates every member (process concluded) but
    does not rewrite any application's status — see module docstring.
    """
    channel = await pipeline_repo.get_channel_by_job(db, job.id)
    if not channel:
        raise ValueError("No pipeline channel exists yet — shortlist a candidate first")

    members = await pipeline_repo.list_active_members(db, channel.id)
    target_status = STAGE_TO_APPLICATION_STATUS.get(stage)

    for member in members:
        application = await application_repo.get_application_by_id(db, member.application_id)
        if not application or application.status in _TERMINAL_STATUSES:
            continue
        if target_status is not None:
            await application_repo.update_application_status(db, application, target_status)
        if stage == PipelineStage.CLOSED:
            await pipeline_repo.deactivate_member(db, channel.id, member.application_id)

    message = await pipeline_repo.create_message(
        db, channel.id, MessageType.SYSTEM,
        f"Pipeline stage advanced to {stage.value.replace('_', ' ')}.",
    )
    await _push_message(channel.id, message)
    return await pipeline_repo.update_stage(db, channel, stage)


# ---------------------------------------------------------------------------
# Employer — channel messaging
# ---------------------------------------------------------------------------

async def post_employer_message(
    db: AsyncSession,
    channel: PipelineChannel,
    sender_id: uuid.UUID,
    message_type: MessageType,
    content: str,
    recipient_application_id: Optional[uuid.UUID],
) -> ChannelMessage:
    """
    Validates and creates an employer-authored message, then pushes it
    live to connected sockets (filtered per-recipient for DIRECT).

    - SYSTEM is server-only — an employer can never post one directly.
    - DIRECT requires a recipient who is a currently-active member of this
      exact channel (not just any application anywhere) — otherwise an
      employer could message a candidate who was already rejected/removed,
      or one belonging to a different job's channel.
    """
    if message_type == MessageType.SYSTEM:
        raise ValueError("System messages are generated by the platform and cannot be sent directly")

    if message_type == MessageType.DIRECT:
        if not recipient_application_id:
            raise ValueError("recipient_application_id is required for direct messages")
        member = await pipeline_repo.get_member(db, channel.id, recipient_application_id)
        if not member or not member.is_active:
            raise ValueError("Recipient is not an active member of this pipeline")

    message = await pipeline_repo.create_message(
        db,
        channel_id=channel.id,
        message_type=message_type,
        content=content,
        sender_id=sender_id,
        recipient_application_id=recipient_application_id if message_type == MessageType.DIRECT else None,
    )
    await _push_message(channel.id, message)
    return message