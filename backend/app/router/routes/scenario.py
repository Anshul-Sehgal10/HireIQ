"""
Scenario question routes (employer-facing generation + preview).

POST /jobs/{job_id}/scenario/generate → run the LangGraph pipeline, store
                                          and return a new active question
GET  /jobs/{job_id}/scenario           → fetch the current active question
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import EmployerUser, get_db
from app.repositories import scenario_repo
from app.repositories.job_repo import get_job
from app.repositories.org_repo import get_org_for_user
from app.schemas.scenario import ScenarioQuestionResponse
from app.services.scenario_generation import generate_scenario_question

router = APIRouter(prefix="/jobs", tags=["scenario"])


async def _get_owned_job(db: AsyncSession, job_id: UUID, user):
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    org = await get_org_for_user(db, user.id)
    if not org or job.org_id != org.id:
        raise HTTPException(403, "Not your job")
    return job


@router.post("/{job_id}/scenario/generate", response_model=ScenarioQuestionResponse)
async def generate(
    job_id: UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generates a new scenario question for this job and makes it the active
    one. Safe to call repeatedly — each call adds a new question row;
    responses already submitted against older questions are unaffected.
    """
    job = await _get_owned_job(db, job_id, user)

    result = await generate_scenario_question(job)
    if result is None:
        raise HTTPException(
            422,
            "Scenario question generation failed — check the LLM service "
            "configuration and try again.",
        )

    question_text, time_limit_seconds = result
    return await scenario_repo.create_scenario_question(
        db, job.id, question_text, time_limit_seconds
    )


@router.get("/{job_id}/scenario", response_model=ScenarioQuestionResponse)
async def get_current(
    job_id: UUID,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await _get_owned_job(db, job_id, user)
    question = await scenario_repo.get_active_question(db, job.id)
    if not question:
        raise HTTPException(404, "No scenario question generated yet for this job")
    return question

@router.get("/{job_id}/scenario/preview", response_model=ScenarioQuestionResponse)
async def get_preview(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Candidate-facing preview of the active scenario question — lets a
    candidate see what they'll be asked before applying. Deliberately no
    auth/ownership check, mirroring GET /jobs/{job_id} which is also public;
    404s if scenario mode is off or no question has been generated yet.
    """
    job = await get_job(db, job_id)
    if not job or not job.scenario_enabled:
        raise HTTPException(404, "This job does not have a scenario question")
    question = await scenario_repo.get_active_question(db, job.id)
    if not question:
        raise HTTPException(404, "No scenario question generated yet for this job")
    return question