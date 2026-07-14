"""
Scenario repository — DB operations for scenario_questions.
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.scenario import ScenarioQuestion


async def create_scenario_question(
    db: AsyncSession,
    job_id: uuid.UUID,
    question_text: str,
    time_limit_seconds: int,
) -> ScenarioQuestion:
    question = ScenarioQuestion(
        job_id=job_id,
        question_text=question_text,
        time_limit_seconds=time_limit_seconds,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


async def get_active_question(
    db: AsyncSession, job_id: uuid.UUID
) -> Optional[ScenarioQuestion]:
    """Latest generated question for a job — the one served to candidates."""
    result = await db.execute(
        select(ScenarioQuestion)
        .where(ScenarioQuestion.job_id == job_id)
        .order_by(ScenarioQuestion.generated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()