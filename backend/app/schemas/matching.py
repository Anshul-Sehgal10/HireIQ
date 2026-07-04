from typing import Optional
from uuid import UUID
from pydantic import BaseModel

class RelevanceCheckResponse(BaseModel):
    resume_version_id: UUID
    match_score: Optional[float]
    match_threshold: float
    meets_threshold: bool