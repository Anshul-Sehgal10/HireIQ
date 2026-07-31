"""
Team chat over WebSocket — real-time push + presence + typing indicators.
The REST endpoints in org_chat.py stay in place for initial history load
on page mount; this socket is purely for what happens after that.

Protocol (JSON frames)
-----------------------
Client -> Server:
  {"type": "message", "content": "..."}
  {"type": "typing_start"}
  {"type": "typing_stop"}

Server -> Client:
  {"type": "message", "data": OrgMessageResponse}
  {"type": "presence", "online_users": [{"user_id","user_name","role"}, ...]}
  {"type": "typing", "user_id", "user_name", "is_typing"}
  {"type": "error", "detail": "..."}
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.ws_auth import authenticate_websocket
from app.core.ws_manager import org_chat_manager
from app.db.models.user import UserRole
from app.db.session import AsyncSessionLocal
from app.repositories import org_repo
from app.services import org_chat_service

router = APIRouter()


@router.websocket("/ws/orgs/mine/chat")
async def org_chat_socket(websocket: WebSocket):
    async with AsyncSessionLocal() as db:
        user = await authenticate_websocket(websocket, db)

        if user.role not in (UserRole.EMPLOYER, UserRole.ADMIN):
            await websocket.close(code=4403, reason="Employer access only")
            return

        org = await org_repo.get_org_for_user(db, user.id)
        if not org:
            await websocket.close(code=4404, reason="Not a member of any organisation")
            return

        room = org_chat_service.room_id(org.id)
        conn_id = await org_chat_manager.connect(room, websocket, user.id, user.full_name, user.role.value)
        await org_chat_manager.broadcast(room, {"type": "presence", "online_users": org_chat_manager.online_users(room)})

        try:
            while True:
                frame = await websocket.receive_json()
                frame_type = frame.get("type")

                if frame_type == "message":
                    content = (frame.get("content") or "").strip()
                    if not content or len(content) > 5000:
                        await websocket.send_json({"type": "error", "detail": "Message must be 1-5000 characters"})
                        continue
                    await org_chat_service.send_message(db, org.id, user.id, user.full_name, content)

                elif frame_type in ("typing_start", "typing_stop"):
                    await org_chat_manager.broadcast(
                        room,
                        {
                            "type": "typing", "user_id": str(user.id), "user_name": user.full_name,
                            "is_typing": frame_type == "typing_start",
                        },
                        exclude_conn_id=conn_id,
                    )
                else:
                    await websocket.send_json({"type": "error", "detail": f"Unknown frame type: {frame_type}"})

        except WebSocketDisconnect:
            pass
        finally:
            await org_chat_manager.disconnect(room, conn_id)
            await org_chat_manager.broadcast(room, {"type": "presence", "online_users": org_chat_manager.online_users(room)})