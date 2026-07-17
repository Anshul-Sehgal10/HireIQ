import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.db.models.pipeline import MessageType, PipelineStage


class ChannelMessageCreate(BaseModel):
    message_type: MessageType = MessageType.BROADCAST
    content: str = Field(min_length=1, max_length=5000)
    recipient_application_id: Optional[uuid.UUID] = None  # required for DIRECT


class ChannelMessageResponse(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: Optional[uuid.UUID]
    recipient_application_id: Optional[uuid.UUID]
    message_type: MessageType
    content: str
    sent_at: datetime

    model_config = {"from_attributes": True}


class StageAdvanceRequest(BaseModel):
    stage: PipelineStage


class PipelineChannelResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    stage: PipelineStage
    created_at: datetime

    model_config = {"from_attributes": True}


class ChannelMemberResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    candidate_name: str
    candidate_email: str
    is_active: bool
    joined_at: datetime


class RankedCandidateResponse(BaseModel):
    """
    Deliberately surfaces resume match score and scenario score as separate
    fields rather than a blended composite — composite scoring is a
    backlog item (deferred), so this stays a display concern for the
    employer, not a computed ranking formula.
    """
    application_id: uuid.UUID
    candidate_id: uuid.UUID
    candidate_name: str
    candidate_email: str
    status: str
    match_score: Optional[float]
    scenario_score: Optional[float]
    scenario_ai_summary: Optional[str]
    is_override: bool
    applied_at: datetime
    in_pipeline: bool