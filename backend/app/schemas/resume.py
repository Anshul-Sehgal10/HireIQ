import uuid
from datetime import datetime
from pydantic import BaseModel


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
    is_current: bool     # True if this is the candidate's active resume

    model_config = {"from_attributes": True}