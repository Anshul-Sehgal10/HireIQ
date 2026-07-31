"""
Pipeline chat over WebSocket. Two connection paths share one room (per
pipeline_channel) so employer and candidate messages interleave live:

  - Employer: WS /ws/jobs/{job_id}/pipeline/chat
  - Candidate: WS /ws/applications/{application_id}/pipeline/chat (read-only —
    there's no candidate POST for pipeline messages on REST either)

All message creation/validation/visibility-filtering lives in
pipeline_service.py so REST and WS both push live updates through the
exact same code path — see that module for the actual logic.

Protocol (JSON frames, employer socket only — candidate socket is receive-only)
---------------------------------------------------------------------------------
Client -> Server:
  {"type": "message", "content": "...", "message_type": "broadcast"|"direct", "recipient_application_id": "..."?}
  {"type": "typing_start"}
  {"type": "typing_stop"}

Server -> Client (both sockets):
  {"type": "message", "data": ChannelMessageResponse}
  {"type": "activity", "message": "..."}   <- ephemeral, not persisted (see shortlist)
  {"type": "typing", "user_id", "user_name", "is_typing"}   <- employer socket only
  {"type": "error", "detail": "..."}
"""

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.ws_auth import authenticate_websocket
from app.core.ws_manager import pipeline_chat_manager
from app.db.models.candidate_profiles import CandidateProfile
from app.db.models.pipeline import MessageType
from app.db.models.user import UserRole
from app.db.session import AsyncSessionLocal
from app.repositories import application_repo, job_repo, pipeline_repo
from app.repositories.org_repo import get_org_for_user
from app.services import pipeline_service

router = APIRouter()


def _room_id(channel_id) -> str:
    return f"pipeline:{channel_id}"


@router.websocket("/ws/jobs/{job_id}/pipeline/chat")
async def employer_pipeline_socket(websocket: WebSocket, job_id: UUID):
    async with AsyncSessionLocal() as db:
        user = await authenticate_websocket(websocket, db)
        if user.role not in (UserRole.EMPLOYER, UserRole.ADMIN):
            await websocket.close(code=4403, reason="Employer access only")
            return

        job = await job_repo.get_job(db, job_id)
        if not job:
            await websocket.close(code=4404, reason="Job not found")
            return
        org = await get_org_for_user(db, user.id)
        if not org or job.org_id != org.id:
            await websocket.close(code=4403, reason="Not your job")
            return

        channel = await pipeline_repo.get_or_create_channel(db, job.id)
        room = _room_id(channel.id)
        conn_id = await pipeline_chat_manager.connect(
            room, websocket, user.id, user.full_name, user.role.value, extra={"application_id": None}
        )

        try:
            while True:
                frame = await websocket.receive_json()
                frame_type = frame.get("type")

                if frame_type == "message":
                    content = (frame.get("content") or "").strip()
                    if not content or len(content) > 5000:
                        await websocket.send_json({"type": "error", "detail": "Message must be 1-5000 characters"})
                        continue
                    message_type_raw = frame.get("message_type", "broadcast")
                    recipient_raw = frame.get("recipient_application_id")
                    try:
                        message_type = MessageType(message_type_raw)
                        await pipeline_service.post_employer_message(
                            db, channel, user.id, message_type, content,
                            UUID(recipient_raw) if recipient_raw else None,
                        )
                    except ValueError as exc:
                        await websocket.send_json({"type": "error", "detail": str(exc)})

                elif frame_type in ("typing_start", "typing_stop"):
                    await pipeline_chat_manager.broadcast_selective(
                        room,
                        lambda info: (
                            {
                                "type": "typing", "user_id": str(user.id), "user_name": user.full_name,
                                "is_typing": frame_type == "typing_start",
                            }
                            if info.role in ("employer", "admin") else None
                        ),
                        exclude_conn_id=conn_id,
                    )
                else:
                    await websocket.send_json({"type": "error", "detail": f"Unknown frame type: {frame_type}"})

        except WebSocketDisconnect:
            pass
        finally:
            await pipeline_chat_manager.disconnect(room, conn_id)


@router.websocket("/ws/applications/{application_id}/pipeline/chat")
async def candidate_pipeline_socket(websocket: WebSocket, application_id: UUID):
    async with AsyncSessionLocal() as db:
        user = await authenticate_websocket(websocket, db)
        if user.role not in (UserRole.CANDIDATE, UserRole.ADMIN):
            await websocket.close(code=4403, reason="Candidate access only")
            return

        result = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
        profile = result.scalar_one_or_none()
        if not profile:
            await websocket.close(code=4404, reason="Candidate profile not found")
            return

        application = await application_repo.get_application_by_id(db, application_id)
        if not application or application.candidate_id != profile.id:
            await websocket.close(code=4404, reason="Application not found")
            return

        channel = await pipeline_repo.get_channel_by_job(db, application.job_id)
        if not channel:
            await websocket.close(code=4404, reason="No pipeline channel yet for this application")
            return

        room = _room_id(channel.id)
        conn_id = await pipeline_chat_manager.connect(
            room, websocket, user.id, user.full_name, user.role.value,
            extra={"application_id": str(application.id)},
        )

        try:
            while True:
                # Read-only for candidates (matches REST — no candidate POST
                # endpoint exists either). Just keeps the loop alive so
                # disconnects are detected; any frame received is ignored.
                await websocket.receive_json()
        except WebSocketDisconnect:
            pass
        finally:
            await pipeline_chat_manager.disconnect(room, conn_id)