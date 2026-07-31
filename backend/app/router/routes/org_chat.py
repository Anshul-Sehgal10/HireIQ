"""
Org-wide internal chat ("Team Chat") — distinct from the per-job pipeline
channel in pipeline.py. Every member of the org can read and post; there
is no candidate-facing surface for this endpoint at all.

REST here is now only responsible for: initial history load (GET), and a
non-WS fallback for posting (POST). Both paths funnel through
org_chat_service.send_message so a REST post also pushes live to anyone
connected via WS — see ws_org_chat.py for the real-time socket.
"""

from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import EmployerUser, get_db
from app.db.models.user import User
from app.repositories import org_message_repo, org_repo
from app.schemas.org_message import OrgMessageCreate, OrgMessageResponse
from app.services import org_chat_service

router = APIRouter(prefix="/orgs/mine/messages", tags=["org-chat"])


@router.get("/", response_model=List[OrgMessageResponse])
async def list_messages(
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")

    messages = await org_message_repo.list_messages(db, org.id)
    result = []
    for m in messages:
        sender = await db.get(User, m.sender_id) if m.sender_id else None
        result.append(OrgMessageResponse(
            id=m.id, org_id=m.org_id, sender_id=m.sender_id,
            sender_name=sender.full_name if sender else None,
            content=m.content, sent_at=m.sent_at, # type: ignore
        ))
    return result


@router.post("/", response_model=OrgMessageResponse, status_code=201)
async def send_message(
    body: OrgMessageCreate,
    user: EmployerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await org_repo.get_org_for_user(db, user.id)
    if not org:
        raise HTTPException(404, "You are not a member of any organisation")

    msg = await org_chat_service.send_message(db, org.id, user.id, user.full_name, body.content)
    return OrgMessageResponse(
        id=msg.id, org_id=msg.org_id, sender_id=msg.sender_id,
        sender_name=user.full_name, content=msg.content, sent_at=msg.sent_at, # type: ignore
    )