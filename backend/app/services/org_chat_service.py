"""
Team chat business logic. Both the REST POST endpoint (org_chat.py) and
the WebSocket route (ws_org_chat.py) call send_message() here instead of
touching org_message_repo directly — guarantees a message posted through
either path always pushes live to every connected socket, not just the
one it came in on.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ws_manager import org_chat_manager
from app.db.models.org_message import OrgMessage
from app.repositories import org_message_repo
from app.schemas.org_message import OrgMessageResponse


def room_id(org_id: UUID) -> str:
    return f"org:{org_id}"


async def send_message(
    db: AsyncSession, org_id: UUID, sender_id: UUID, sender_name: str, content: str
) -> OrgMessage:
    msg = await org_message_repo.create_message(db, org_id, sender_id, content)
    payload = OrgMessageResponse(
        id=msg.id, org_id=msg.org_id, sender_id=msg.sender_id,
        sender_name=sender_name, content=msg.content, sent_at=msg.sent_at, # type: ignore
    )
    await org_chat_manager.broadcast(
        room_id(org_id), {"type": "message", "data": payload.model_dump(mode="json")}
    )
    return msg