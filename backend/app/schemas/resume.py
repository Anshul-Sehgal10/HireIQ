import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    # .docx
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class ResumeUploadRequest(BaseModel):
    filename: str        # original filename, used to build the S3 key
    content_type: str    # validated against ALLOWED_CONTENT_TYPES in the route


class PresignedUploadResponse(BaseModel):
    upload_url: str
    resume_version_id: uuid.UUID
    s3_key: str
    version_number: int


class ResumeVersionResponse(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    s3_key: str
    version_number: int
    created_at: datetime
    label: Optional[str] = None
    is_current: bool     # True if this is the candidate's active resume
    has_embedding: bool  # lets the UI show "retry embedding"

    model_config = {"from_attributes": True}

class ResumeExtractionDetailResponse(BaseModel):
    id: uuid.UUID
    version_number: int
    label: Optional[str] = None
    categories: Optional[list[str]] = None
    parsed_data: Optional[dict] = None
    has_embedding: bool

    model_config = {"from_attributes": True}

class ResumeRenameRequest(BaseModel):
    label: str = Field(min_length=1, max_length=255)