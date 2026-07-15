import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ScenarioQuestionResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    question_text: str
    time_limit_seconds: int
    started_at: datetime
    time_remaining_seconds: int  # computed server-side, clamped to >= 0


class ScenarioSubmitRequest(BaseModel):
    response_text: str = Field(min_length=1)
    paste_detected: bool = False
    tab_switches: int = 0


class ScenarioResultResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    score: Optional[float]
    ai_summary: Optional[str]
    time_taken_seconds: Optional[int]
    paste_detected: bool
    tab_switches: int
    submitted_at: datetime

    model_config = {"from_attributes": True}


class ScenarioPreviewResponse(BaseModel):
    """Ephemeral, non-persisted preview for the employer 'test' button —
    shows what kind of question the pipeline would generate for this job,
    without creating a row (there's no application to attach it to)."""
    question_text: str
    suggested_time_limit_seconds: int