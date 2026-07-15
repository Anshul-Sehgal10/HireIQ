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
from app.repositories.resume_repo import increment_override_usage
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

async def _get_candidate_profile(db: AsyncSession, user_id) -> CandidateProfile:
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Candidate profile not found")
    return profile

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
    
    if await scenario_repo.get_response_for_application(db, application_id):
        raise HTTPException(400, "You've already submitted a response for this scenario")
    
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

    if application.status != ApplicationStatus.SCENARIO_PENDING:
        raise HTTPException(400, "This application does not have a pending scenario test")

    question = await scenario_repo.get_question_for_application(db, application_id)
    if not question:
        raise HTTPException(400, "You must start the scenario before submitting")

    if await scenario_repo.get_response_for_application(db, application_id):
        raise HTTPException(400, "You've already submitted a response for this scenario")

    job = await job_repo.get_job(db, application.job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    time_taken_seconds = int(
        (datetime.now(timezone.utc) - question.started_at).total_seconds() #type: ignore
    )
    evaluation = await evaluate_scenario_response(job, question.question_text, body.response_text)
    score = evaluation.score if evaluation else None

    scenario_response = await scenario_repo.create_scenario_response(
        db,
        application_id=application_id,
        question_id=question.id,
        response_text=body.response_text,
        score=score,
        ai_summary=evaluation.summary if evaluation else None,
        paste_detected=body.paste_detected,
        tab_switches=body.tab_switches,
        time_taken_seconds=time_taken_seconds,
    )

    # An ungraded response (evaluation call failed) is let through rather than
    # blocked — an infra hiccup on our end shouldn't cost the candidate their
    # attempt or an override. It's surfaced to the employer as ungraded instead.
    meets_threshold = score is None or score >= job.scenario_score_threshold

    if meets_threshold:
        application = await application_repo.mark_scenario_finalized(
            db, application, ApplicationStatus.SCENARIO_SUBMITTED, is_override=False
        )

    profile = await _get_candidate_profile(db, user.id)
    overrides_remaining = max(0, profile.override_apps_limit - profile.override_apps_used)

    return ScenarioResultResponse(
        id=scenario_response.id,
        application_id=scenario_response.application_id,
        score=scenario_response.score,
        ai_summary=scenario_response.ai_summary,
        time_taken_seconds=scenario_response.time_taken_seconds,
        paste_detected=scenario_response.paste_detected,
        tab_switches=scenario_response.tab_switches,
        submitted_at=scenario_response.submitted_at, #type: ignore
        meets_threshold=meets_threshold,
        scenario_score_threshold=job.scenario_score_threshold,
        requires_override=not meets_threshold,
        overrides_remaining=overrides_remaining,
    )
    

@candidate_router.post("/{application_id}/scenario/override", response_model=ScenarioResultResponse)
async def override_scenario(
    application_id: UUID,
    user: CandidateUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Candidate has already seen their below-threshold scenario score and
    chooses to proceed anyway, spending one override for the month — same
    quota pool used for below-threshold resume matches at apply time.
    """
    profile = await _get_candidate_profile(db, user.id)
    application = await application_repo.get_application_by_id(db, application_id)
    if not application or application.candidate_id != profile.id:
        raise HTTPException(404, "Application not found")

    if application.status != ApplicationStatus.SCENARIO_PENDING:
        raise HTTPException(400, "This application does not have a pending scenario test")

    scenario_response = await scenario_repo.get_response_for_application(db, application_id)
    if not scenario_response:
        raise HTTPException(400, "You must submit your scenario answer before overriding")

    if profile.override_apps_used >= profile.override_apps_limit:
        raise HTTPException(400, "You've used all your override applications for this month.")

    job = await job_repo.get_job(db, application.job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    await increment_override_usage(db, profile)
    application = await application_repo.mark_scenario_finalized(
        db, application, ApplicationStatus.SCENARIO_SUBMITTED, is_override=True
    )

    return ScenarioResultResponse(
        id=scenario_response.id,
        application_id=scenario_response.application_id,
        score=scenario_response.score,
        ai_summary=scenario_response.ai_summary,
        time_taken_seconds=scenario_response.time_taken_seconds,
        paste_detected=scenario_response.paste_detected,
        tab_switches=scenario_response.tab_switches,
        submitted_at=scenario_response.submitted_at, #type: ignore
        meets_threshold=True,
        scenario_score_threshold=job.scenario_score_threshold,
        requires_override=False,
        overrides_remaining=max(0, profile.override_apps_limit - profile.override_apps_used),
    )