"""
Pipeline routes — shortlist/reject candidates, advance channel stage,
post/read pipeline messages, and the ranked candidate dashboard.

Employer-facing:
  POST /jobs/{job_id}/pipeline/shortlist/{application_id}
  POST /jobs/{job_id}/pipeline/reject/{application_id}
  POST /jobs/{job_id}/pipeline/advance
  GET  /jobs/{job_id}/pipeline/members
  GET  /jobs/{job_id}/pipeline/messages
  POST /jobs/{job_id}/pipeline/messages
  GET  /jobs/{job_id}/candidates/ranked

Candidate-facing:
  GET  /applications/{application_id}/pipeline/messages
"""

# Types 
import uuid
from typing import Annotated, List

# FastAPI and SQLAlchemy
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# Auth and logging
from app.core.dependencies import CandidateUser, EmployerUser, get_db

# Database models
from app.db.models.application import ApplicationStatus
from app.db.models.pipeline import MessageType

# Repositories and CRUD functions
from app.repositories import application_repo, job_repo, pipeline_repo
from app.repositories.org_repo import get_org_for_user

# Pydantic schemas
from app.schemas.pipeline import (
    ChannelMemberResponse,
    ChannelMessageCreate,
    ChannelMessageResponse,
    PipelineChannelResponse,
    RankedCandidateResponse,
    StageAdvanceRequest,
)

# Services for business logic
from app.services import pipeline_service
from app.services.matching import compute_composite_score

employer_router = APIRouter(prefix="/jobs", tags=["pipeline"])
candidate_router = APIRouter(prefix="/applications", tags=["pipeline"])


async def _assert_owns_job(db: AsyncSession, user, job_id: uuid.UUID):
    job = await job_repo.get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return job


# ---------------------------------------------------------------------------
# Employer — shortlist / reject / advance
# ---------------------------------------------------------------------------

@employer_router.post("/{job_id}/pipeline/shortlist/{application_id}", response_model=PipelineChannelResponse)
async def shortlist(
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await _assert_owns_job(db, user, job_id)
    application = await application_repo.get_application_by_id(db, application_id)
    if not application or application.job_id != job_id:
        raise HTTPException(404, "Application not found")

    try:
        channel = await pipeline_service.shortlist_application(db, job, application)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return channel


@employer_router.post("/{job_id}/pipeline/reject/{application_id}", status_code=204)
async def reject(
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await _assert_owns_job(db, user, job_id)
    application = await application_repo.get_application_by_id(db, application_id)
    if not application or application.job_id != job_id:
        raise HTTPException(404, "Application not found")

    await pipeline_service.reject_application(db, job, application)


@employer_router.post("/{job_id}/pipeline/advance", response_model=PipelineChannelResponse)
async def advance(
    job_id: uuid.UUID,
    body: StageAdvanceRequest,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await _assert_owns_job(db, user, job_id)
    try:
        channel = await pipeline_service.advance_stage(db, job, body.stage)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return channel


# ---------------------------------------------------------------------------
# Employer — members / messages
# ---------------------------------------------------------------------------

@employer_router.get("/{job_id}/pipeline/members", response_model=List[ChannelMemberResponse])
async def list_members(
    job_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _assert_owns_job(db, user, job_id)
    channel = await pipeline_repo.get_channel_by_job(db, job_id)
    if not channel:
        return []

    members = await pipeline_repo.list_active_members(db, channel.id)
    result = []
    for m in members:
        app = m.application
        cp = app.candidate_profile
        u = cp.user if cp else None
        result.append(ChannelMemberResponse(
            id=m.id,
            application_id=m.application_id,
            candidate_name=u.full_name if u else "Unknown",
            candidate_email=u.email if u else "",
            is_active=m.is_active,
            joined_at=m.joined_at,  # type: ignore
        ))
    return result


@employer_router.get("/{job_id}/pipeline/messages", response_model=List[ChannelMessageResponse])
async def employer_messages(
    job_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _assert_owns_job(db, user, job_id)
    channel = await pipeline_repo.get_channel_by_job(db, job_id)
    if not channel:
        return []
    return await pipeline_repo.list_messages_for_employer(db, channel.id)


@employer_router.post("/{job_id}/pipeline/messages", response_model=ChannelMessageResponse, status_code=201)
async def send_message(
    job_id: uuid.UUID,
    body: ChannelMessageCreate,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _assert_owns_job(db, user, job_id)
    channel = await pipeline_repo.get_channel_by_job(db, job_id)
    if not channel:
        raise HTTPException(400, "No pipeline channel exists yet — shortlist a candidate first")

    try:
        message = await pipeline_service.post_employer_message(
            db, channel, user.id, body.message_type, body.content, body.recipient_application_id
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return message


# ---------------------------------------------------------------------------
# Employer — ranked candidate dashboard
# ---------------------------------------------------------------------------

@employer_router.get("/{job_id}/candidates/ranked", response_model=List[RankedCandidateResponse])
async def ranked_candidates(
    job_id: uuid.UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await _assert_owns_job(db, user, job_id)
    applications = await application_repo.list_ranked_for_job(db, job_id)

    channel = await pipeline_repo.get_channel_by_job(db, job_id)
    active_application_ids = set()
    if channel:
        members = await pipeline_repo.list_active_members(db, channel.id)
        active_application_ids = {m.application_id for m in members}

    result = []
    for app in applications:
        if app.status in (ApplicationStatus.WITHDRAWN, ApplicationStatus.SCENARIO_PENDING):
            continue
        cp = app.candidate_profile
        u = cp.user if cp else None
        sr = app.scenario_response
        scenario_score = sr.score if sr else None
        composite = compute_composite_score(app.match_score, scenario_score, job.scenario_enabled)
        result.append(RankedCandidateResponse(
            application_id=app.id,
            candidate_id=app.candidate_id,
            candidate_name=u.full_name if u else "Unknown",
            candidate_email=u.email if u else "",
            status=app.status.value if hasattr(app.status, "value") else app.status,
            match_score=app.match_score,
            scenario_score=scenario_score,
            scenario_ai_summary=sr.ai_summary if sr else None,
            composite_score=composite,
            is_override=app.is_override,
            applied_at=app.applied_at,  # type: ignore
            in_pipeline=app.id in active_application_ids,
        ))

    # None sorts last regardless of direction — a candidate with no
    # computable score shouldn't outrank one who has any signal at all.
    result.sort(key=lambda r: (r.composite_score is None, -(r.composite_score or 0)))
    return result

# ---------------------------------------------------------------------------
# Candidate — read own pipeline messages
# ---------------------------------------------------------------------------

@candidate_router.get("/{application_id}/pipeline/messages", response_model=List[ChannelMessageResponse])
async def candidate_messages(
    application_id: uuid.UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.db.models.candidate_profiles import CandidateProfile
    from sqlalchemy import select

    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")

    application = await application_repo.get_application_by_id(db, application_id)
    if not application or application.candidate_id != profile.id:
        raise HTTPException(404, "Application not found")

    channel = await pipeline_repo.get_channel_by_job(db, application.job_id)
    if not channel:
        return []

    return await pipeline_repo.list_messages_for_candidate(db, channel.id, application_id)