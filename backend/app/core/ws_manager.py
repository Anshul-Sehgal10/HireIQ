"""
In-memory WebSocket connection manager.

Design notes
------------
- Single-process only: connections live in a plain dict, so this does NOT
  fan out across multiple uvicorn workers/replicas without a shared
  pub/sub layer (e.g. Redis). Fine for the current single-process deploy;
  flagged here as a scaling limitation for Phase 5.
- Rooms are just string keys — callers own the room-id scheme
  (e.g. f"org:{org_id}", f"pipeline:{channel_id}").
- Presence (who's online) is derived directly from the connections dict,
  not tracked in a separate structure — one source of truth, dedup'd by
  user_id since the same user can have multiple tabs open.
"""

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Callable, Optional

from fastapi import WebSocket


@dataclass
class ConnectionInfo:
    websocket: WebSocket
    user_id: uuid.UUID
    user_name: str
    role: str
    extra: dict = field(default_factory=dict)  # e.g. {"application_id": "..."} for candidate pipeline sockets


class ConnectionManager:
    def __init__(self):
        # room_id -> {connection_id: ConnectionInfo}
        self._rooms: dict[str, dict[str, ConnectionInfo]] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        room_id: str,
        websocket: WebSocket,
        user_id: uuid.UUID,
        user_name: str,
        role: str,
        extra: Optional[dict] = None,
    ) -> str:
        await websocket.accept()
        conn_id = str(uuid.uuid4())
        async with self._lock:
            self._rooms.setdefault(room_id, {})[conn_id] = ConnectionInfo(
                websocket=websocket, user_id=user_id, user_name=user_name,
                role=role, extra=extra or {},
            )
        return conn_id

    async def disconnect(self, room_id: str, conn_id: str) -> None:
        async with self._lock:
            room = self._rooms.get(room_id)
            if room and conn_id in room:
                del room[conn_id]
                if not room:
                    del self._rooms[room_id]

    def online_users(self, room_id: str) -> list[dict]:
        """Deduplicated by user_id — one entry even if a user has 2 tabs open."""
        room = self._rooms.get(room_id, {})
        seen: dict[str, dict] = {}
        for info in room.values():
            seen[str(info.user_id)] = {
                "user_id": str(info.user_id), "user_name": info.user_name, "role": info.role,
            }
        return list(seen.values())

    async def broadcast(
        self, room_id: str, payload: dict, exclude_conn_id: Optional[str] = None
    ) -> None:
        await self.broadcast_selective(
            room_id, lambda _info: payload, exclude_conn_id=exclude_conn_id
        )

    async def broadcast_selective(
        self,
        room_id: str,
        build_payload: Callable[[ConnectionInfo], Optional[dict]],
        exclude_conn_id: Optional[str] = None,
    ) -> None:
        """Per-connection payload — return None from build_payload to skip
        that connection (used for pipeline direct-message filtering)."""
        room = self._rooms.get(room_id, {})
        dead: list[str] = []
        for conn_id, info in list(room.items()):
            if conn_id == exclude_conn_id:
                continue
            payload = build_payload(info)
            if payload is None:
                continue
            try:
                await info.websocket.send_json(payload)
            except Exception:
                dead.append(conn_id)
        for conn_id in dead:
            await self.disconnect(room_id, conn_id)


# Two independent managers — keeps org-chat and pipeline-chat room
# namespaces from ever cross-wiring even if a UUID collided.
org_chat_manager = ConnectionManager()
pipeline_chat_manager = ConnectionManager()