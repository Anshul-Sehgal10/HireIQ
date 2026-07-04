from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field
from app.db.models.job import JobStatus, WorkMode, JobLevel

class JobCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=50)
    work_mode: Optional[WorkMode] = None
    job_level: Optional[JobLevel] = None
    location: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    hiring_count: int = 1
    scenario_enabled: bool = False
    match_threshold: float = Field(default=0.65, ge=0.0, le=1.0)

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    work_mode: Optional[WorkMode] = None
    job_level: Optional[JobLevel] = None
    location: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    hiring_count: Optional[int] = None
    scenario_enabled: Optional[bool] = None
    match_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)

class JobResponse(BaseModel):
    id: UUID
    org_id: UUID
    title: str
    description: str
    status: JobStatus
    work_mode: Optional[WorkMode]
    job_level: Optional[JobLevel]
    location: Optional[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    hiring_count: int
    scenario_enabled: bool
    match_threshold: float
    categories: Optional[list[str]] = None

    model_config = {"from_attributes": True}

class JobDetailResponse(JobResponse):
    org_name: str
    org_domain: Optional[str]
    org_verification_status: str