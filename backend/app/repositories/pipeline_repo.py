"""
Pipeline repository — DB operations for pipeline_channels, channel_members,
channel_messages.
"""

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.models.pipeline import (
    ChannelMember,
    ChannelMessage,
    MessageType,
    PipelineChannel,
    PipelineStage,
)
from app.db.models.application import Application
from app.db.models.candidate_profiles import CandidateProfile


# ---------------------------------------------------------------------------
# Channels
# ---------------------------------------------------------------------------

async def get_channel_by_job(db: AsyncSession, job_id: uuid.UUID) -> Optional[PipelineChannel]:
    result = await db.execute(
        select(PipelineChannel).where(PipelineChannel.job_id == job_id)
    )
    return result.scalar_one_or_none()


async def get_or_create_channel(db: AsyncSession, job_id: uuid.UUID) -> PipelineChannel:
    channel = await get_channel_by_job(db, job_id)
    if channel:
        return channel
    channel = PipelineChannel(job_id=job_id)
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return channel


async def update_stage(
    db: AsyncSession, channel: PipelineChannel, stage: PipelineStage
) -> PipelineChannel:
    channel.stage = stage
    await db.commit()
    await db.refresh(channel)
    return channel


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

async def get_member(
    db: AsyncSession, channel_id: uuid.UUID, application_id: uuid.UUID
) -> Optional[ChannelMember]:
    result = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.application_id == application_id,
        )
    )
    return result.scalar_one_or_none()


async def add_member(
    db: AsyncSession, channel_id: uuid.UUID, application_id: uuid.UUID
) -> ChannelMember:
    """
    Idempotent: reactivates an existing (possibly deactivated) membership
    rather than violating the unique constraint — a candidate who was
    rejected and later reconsidered should rejoin cleanly.
    """
    existing = await get_member(db, channel_id, application_id)
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.removed_at = None
            await db.commit()
            await db.refresh(existing)
        return existing

    member = ChannelMember(channel_id=channel_id, application_id=application_id)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def deactivate_member(
    db: AsyncSession, channel_id: uuid.UUID, application_id: uuid.UUID
) -> Optional[ChannelMember]:
    from datetime import datetime, timezone

    member = await get_member(db, channel_id, application_id)
    if not member:
        return None
    member.is_active = False
    member.removed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(member)
    return member


async def list_active_members(db: AsyncSession, channel_id: uuid.UUID) -> List[ChannelMember]:
    result = await db.execute(
        select(ChannelMember)
        .options(
            joinedload(ChannelMember.application)
            .joinedload(Application.candidate_profile)
            .joinedload(CandidateProfile.user),
        )
        .where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.is_active.is_(True),
        )
        .order_by(ChannelMember.joined_at.asc())
    )
    return list(result.unique().scalars().all())


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

async def create_message(
    db: AsyncSession,
    channel_id: uuid.UUID,
    message_type: MessageType,
    content: str,
    sender_id: Optional[uuid.UUID] = None,
    recipient_application_id: Optional[uuid.UUID] = None,
) -> ChannelMessage:
    message = ChannelMessage(
        channel_id=channel_id,
        sender_id=sender_id,
        recipient_application_id=recipient_application_id,
        message_type=message_type,
        content=content,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def list_messages_for_employer(
    db: AsyncSession, channel_id: uuid.UUID
) -> List[ChannelMessage]:
    """Employer sees every message in the channel — broadcast, system, and
    all direct messages regardless of recipient."""
    result = await db.execute(
        select(ChannelMessage)
        .where(ChannelMessage.channel_id == channel_id)
        .order_by(ChannelMessage.sent_at.asc())
    )
    return list(result.scalars().all())


async def list_messages_for_candidate(
    db: AsyncSession, channel_id: uuid.UUID, application_id: uuid.UUID
) -> List[ChannelMessage]:
    """
    Candidate view: broadcast + system messages (visible to everyone in the
    channel) plus direct messages addressed specifically to them. Never
    another candidate's direct messages.
    """
    from sqlalchemy import or_

    result = await db.execute(
        select(ChannelMessage)
        .where(
            ChannelMessage.channel_id == channel_id,
            or_(
                ChannelMessage.message_type.in_([MessageType.BROADCAST, MessageType.SYSTEM]),
                ChannelMessage.recipient_application_id == application_id,
            ),
        )
        .order_by(ChannelMessage.sent_at.asc())
    )
    return list(result.scalars().all())