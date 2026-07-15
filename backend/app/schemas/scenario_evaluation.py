from pydantic import BaseModel, Field


class ScenarioEvaluation(BaseModel):
    """LLM output for grading a candidate's scenario response."""
    score: float = Field(
        ge=0.0, le=1.0,
        description="Overall quality of the response as a fraction from 0 to 1. "
                     "Judge relevance to the scenario, technical/practical soundness "
                     "for the role's seniority level, and clarity of reasoning. "
                     "A vague or off-topic answer should score low even if long; "
                     "a short but sharply on-point answer should score well.",
    )
    summary: str = Field(
        description="~3 sentence plain-text explanation for the employer: what the "
                     "candidate got right, what was missing or weak, and whether the "
                     "response reflects genuine understanding of the scenario.",
    )