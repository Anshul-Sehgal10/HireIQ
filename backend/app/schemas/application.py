from uuid import UUID
from typing import Optional
from pydantic import BaseModel
from app.db.models.application import ApplicationStatus
from app.db.models.job import JobStatus, WorkMode, JobLevel


class ApplicationCreate(BaseModel):
    job_id: UUID


class ApplicationResponse(BaseModel):
    id: UUID
    job_id: UUID
    candidate_id: UUID
    status: ApplicationStatus
    match_score: Optional[float]
    is_override: bool
    applied_at: object

    model_config = {"from_attributes": True}


class ApplicationWithJobResponse(ApplicationResponse):
    """Application with denormalised job fields for candidate dashboard."""
    job_title: str
    job_location: Optional[str]
    job_work_mode: Optional[WorkMode]
    job_level: Optional[JobLevel]
    job_status: JobStatus
    org_name: str