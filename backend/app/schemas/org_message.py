import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class OrgMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class OrgMessageResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    sender_id: Optional[uuid.UUID]
    sender_name: Optional[str] = None
    content: str
    sent_at: datetime

    model_config = {"from_attributes": True}