from typing import Optional
from pydantic import BaseModel, Field


class ScenarioDraft(BaseModel):
    """LLM output for a single scenario-question generation attempt."""
    question_text: str = Field(
        description="The scenario question posed to the candidate, plain text only."
    )
    suggested_time_limit_seconds: int = Field(
        ge=120, le=300,
        description="Suggested time limit for a candidate to answer, in seconds.",
    )


class ScenarioCritique(BaseModel):
    """LLM self-critique of a drafted scenario question."""
    passes: bool = Field(
        description="True if the question is specific, answerable in the time "
                     "limit, and free of generic filler — ready to serve to candidates."
    )
    feedback: Optional[str] = Field(
        default=None,
        description="If passes=False, concrete feedback on what to fix in the next draft.",
    )