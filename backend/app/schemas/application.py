from uuid import UUID
from typing import Optional
from pydantic import BaseModel
from app.db.models.application import ApplicationStatus
from app.db.models.job import JobStatus, WorkMode, JobLevel


class ApplicationCreate(BaseModel):
    job_id: UUID
    resume_version_id: Optional[UUID] = None  # None → use current active resume
    override: bool = False  # candidate explicitly wants to apply despite a low match


class ApplicationResponse(BaseModel):
    """Returned to the candidate — their own application."""
    id: UUID
    job_id: UUID
    candidate_id: UUID
    status: ApplicationStatus
    match_score: Optional[float]
    is_override: bool
    applied_at: object

    model_config = {"from_attributes": True}


class ApplicationWithJobResponse(ApplicationResponse):
    """Application enriched with job + org fields for candidate dashboard."""
    job_title: str
    job_location: Optional[str]
    job_work_mode: Optional[WorkMode]
    job_level: Optional[JobLevel]
    job_status: JobStatus
    org_name: str


class EmployerApplicationResponse(BaseModel):
    """
    Returned to the employer for GET /applications/job/{job_id}.
    Candidate identity is joined from candidate_profile -> user server-side;
    it is never read from the Application ORM object directly.
    """
    id: UUID
    job_id: UUID
    candidate_id: UUID
    applicant_name: str
    applicant_email: str
    status: ApplicationStatus
    match_score: Optional[float]
    is_override: bool
    applied_at: object
    resume_version_id: UUID

    model_config = {"from_attributes": True}