"""
Scenario repository — DB operations for scenario_questions and scenario_responses.
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.scenario import ScenarioQuestion, ScenarioResponse


# ---------------------------------------------------------------------------
# scenario_questions
# ---------------------------------------------------------------------------

async def create_scenario_question(
    db: AsyncSession,
    application_id: uuid.UUID,
    question_text: str,
    time_limit_seconds: int,
) -> ScenarioQuestion:
    question = ScenarioQuestion(
        application_id=application_id,
        question_text=question_text,
        time_limit_seconds=time_limit_seconds,
    )
    db.add(question)
    try:
        await db.commit()
        await db.refresh(question)
        return question
    except IntegrityError:
        await db.rollback()
        existing = await get_question_for_application(db, application_id)
        if existing:
            return existing
        raise


async def get_question_for_application(
    db: AsyncSession, application_id: uuid.UUID
) -> Optional[ScenarioQuestion]:
    result = await db.execute(
        select(ScenarioQuestion).where(ScenarioQuestion.application_id == application_id)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# scenario_responses
# ---------------------------------------------------------------------------

async def create_scenario_response(
    db: AsyncSession,
    application_id: uuid.UUID,
    question_id: uuid.UUID,
    response_text: str,
    score: Optional[float],
    ai_summary: Optional[str],
    paste_detected: bool,
    tab_switches: int,
    time_taken_seconds: Optional[int],
) -> ScenarioResponse:
    scenario_response = ScenarioResponse(
        application_id=application_id,
        question_id=question_id,
        response_text=response_text,
        score=score,
        ai_summary=ai_summary,
        paste_detected=paste_detected,
        tab_switches=tab_switches,
        time_taken_seconds=time_taken_seconds,
    )
    db.add(scenario_response)
    await db.commit()
    await db.refresh(scenario_response)
    return scenario_response


async def get_response_for_application(
    db: AsyncSession, application_id: uuid.UUID
) -> Optional[ScenarioResponse]:
    result = await db.execute(
        select(ScenarioResponse).where(ScenarioResponse.application_id == application_id)
    )
    return result.scalar_one_or_none()

async def delete_attempt_for_application(db: AsyncSession, application_id: uuid.UUID) -> None:
    """Removes any prior question/response for this application, so a
    withdraw-then-reapply gets a genuinely fresh attempt rather than being
    permanently blocked by leftover rows from the withdrawn attempt."""
    response = await get_response_for_application(db, application_id)
    if response:
        await db.delete(response)
        await db.commit()
    question = await get_question_for_application(db, application_id)
    if question:
        await db.delete(question)
        await db.commit()