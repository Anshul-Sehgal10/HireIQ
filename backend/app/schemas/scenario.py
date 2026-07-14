import uuid
from datetime import datetime
from pydantic import BaseModel


class ScenarioQuestionResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    question_text: str
    time_limit_seconds: int
    generated_at: datetime

    model_config = {"from_attributes": True}