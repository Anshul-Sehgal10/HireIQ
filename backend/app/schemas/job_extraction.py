from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.categories import JobCategory


class JDSkills(BaseModel):
    required: List[str] = Field(default_factory=list)
    preferred: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    frameworks_tools: List[str] = Field(default_factory=list)
    cloud_platforms: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)


class JDExtraction(BaseModel):
    """Top-level structured output requested from the LLM for a job description."""
    role_summary: Optional[str] = Field(
        default=None, description="1-2 sentence normalized summary of the role"
    )
    seniority_level: Optional[str] = Field(
        default=None, description="e.g. intern, junior, mid, senior, lead"
    )
    min_years_experience: Optional[int] = None
    responsibilities: List[str] = Field(default_factory=list)
    skills: JDSkills = Field(default_factory=JDSkills)
    education_requirements: List[str] = Field(default_factory=list)
    categories: List[JobCategory] = Field(
        default_factory=list,
        description="1-3 categories that best describe this role's primary domain(s)",
    )