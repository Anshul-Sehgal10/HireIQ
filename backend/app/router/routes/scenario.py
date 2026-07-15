"""
Scenario question routes.

Employer-facing:
  POST /jobs/{job_id}/scenario/test-preview → ephemeral, non-persisted preview
                                                of what the pipeline would generate

Candidate-facing:
  POST /applications/{application_id}/scenario/start  → generate (or fetch existing)
                                                          question for this attempt
  GET  /applications/{application_id}/scenario         → poll current question + time left
  POST /applications/{application_id}/scenario/submit  → submit answer, get scored
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CandidateUser, EmployerUser, get_db
from app.db.models.application import Application, ApplicationStatus
from app.db.models.candidate_profiles import CandidateProfile
from app.repositories import scenario_repo, application_repo, job_repo
from app.repositories.org_repo import get_org_for_user
from sqlalchemy import select
from app.schemas.scenario import (
    ScenarioPreviewResponse,
    ScenarioQuestionResponse,
    ScenarioResultResponse,
    ScenarioSubmitRequest,
)
from app.services.scenario_generation import generate_scenario_question
from app.services.scenario_evaluation import evaluate_scenario_response

employer_router = APIRouter(prefix="/jobs", tags=["scenario"])
candidate_router = APIRouter(prefix="/applications", tags=["scenario"])


# ---------------------------------------------------------------------------
# Employer — ephemeral preview (no persistence, no application to attach to)
# ---------------------------------------------------------------------------

@employer_router.post("/{job_id}/scenario/test-preview", response_model=ScenarioPreviewResponse)
async def test_preview(
    job_id: UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Runs the generation pipeline once so the employer can see what kind of
    question candidates would get, without saving anything — real questions
    are generated fresh per candidate attempt (see candidate_router below).
    """
    job = await job_repo.get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")

    result = await generate_scenario_question(job)
    if result is None:
        raise HTTPException(
            422,
            "Scenario question generation failed — check the LLM service "
            "configuration and try again.",
        )
    question_text, time_limit_seconds = result
    return ScenarioPreviewResponse(
        question_text=question_text,
        suggested_time_limit_seconds=time_limit_seconds,
    )


# ---------------------------------------------------------------------------
# Candidate — helpers
# ---------------------------------------------------------------------------

async def _get_owned_application(
    db: AsyncSession, application_id: UUID, user
) -> Application:
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")

    application = await application_repo.get_application_by_id(db, application_id)
    if not application or application.candidate_id != profile.id:
        raise HTTPException(404, "Application not found")
    return application


def _to_question_response(question) -> ScenarioQuestionResponse:
    elapsed = (datetime.now(timezone.utc) - question.started_at).total_seconds()
    remaining = max(0, int(question.time_limit_seconds - elapsed))
    return ScenarioQuestionResponse(
        id=question.id,
        application_id=question.application_id,
        question_text=question.question_text,
        time_limit_seconds=question.time_limit_seconds,
        started_at=question.started_at,
        time_remaining_seconds=remaining,
    )


# ---------------------------------------------------------------------------
# Candidate — start attempt
# ---------------------------------------------------------------------------

@candidate_router.post("/{application_id}/scenario/start", response_model=ScenarioQuestionResponse)
async def start_scenario(
    application_id: UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    application = await _get_owned_application(db, application_id, user)

    if application.status == ApplicationStatus.SCENARIO_SUBMITTED:
        raise HTTPException(400, "You've already submitted this scenario question")
    if application.status != ApplicationStatus.SCENARIO_PENDING:
        raise HTTPException(400, "This application does not have a pending scenario test")

    # Idempotent — page refresh / re-navigation should resume the same
    # question and clock rather than generating a new one.
    existing = await scenario_repo.get_question_for_application(db, application_id)
    if existing:
        return _to_question_response(existing)

    job = await job_repo.get_job(db, application.job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    result = await generate_scenario_question(job)
    if result is None:
        raise HTTPException(
            422,
            "Scenario question generation failed — check the LLM service "
            "configuration and try again.",
        )
    question_text, time_limit_seconds = result
    question = await scenario_repo.create_scenario_question(
        db, application_id, question_text, time_limit_seconds
    )
    return _to_question_response(question)


# ---------------------------------------------------------------------------
# Candidate — poll current question / time remaining
# ---------------------------------------------------------------------------

@candidate_router.get("/{application_id}/scenario", response_model=ScenarioQuestionResponse)
async def get_scenario(
    application_id: UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    application = await _get_owned_application(db, application_id, user)
    question = await scenario_repo.get_question_for_application(db, application_id)
    if not question:
        raise HTTPException(404, "Scenario question has not been started yet")
    return _to_question_response(question)


# ---------------------------------------------------------------------------
# Candidate — submit answer
# ---------------------------------------------------------------------------

@candidate_router.post("/{application_id}/scenario/submit", response_model=ScenarioResultResponse)
async def submit_scenario(
    application_id: UUID,
    body: ScenarioSubmitRequest,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    application = await _get_owned_application(db, application_id, user)

    if application.status == ApplicationStatus.SCENARIO_SUBMITTED:
        raise HTTPException(400, "You've already submitted this scenario question")
    if application.status != ApplicationStatus.SCENARIO_PENDING:
        raise HTTPException(400, "This application does not have a pending scenario test")

    question = await scenario_repo.get_question_for_application(db, application_id)
    if not question:
        raise HTTPException(400, "You must start the scenario before submitting")

    job = await job_repo.get_job(db, application.job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    # Server-side clock is the source of truth — the client-side timer is UX only.
    time_taken_seconds = int(
        (datetime.now(timezone.utc) - question.started_at).total_seconds() # type: ignore
    )

    evaluation = await evaluate_scenario_response(job, question.question_text, body.response_text)

    scenario_response = await scenario_repo.create_scenario_response(
        db,
        application_id=application_id,
        question_id=question.id,
        response_text=body.response_text,
        score=evaluation.score if evaluation else None,
        ai_summary=evaluation.summary if evaluation else None,
        paste_detected=body.paste_detected,
        tab_switches=body.tab_switches,
        time_taken_seconds=time_taken_seconds,
    )

    await application_repo.update_application_status(
        db, application, ApplicationStatus.SCENARIO_SUBMITTED
    )

    return scenario_response