"""
WebSocket authentication — reuses the same access_token cookie the REST
API already relies on (get_current_user in dependencies.py), since
browsers attach cookies to the WS handshake automatically.

Origin check
------------
Unlike fetch(), a WebSocket handshake is NOT covered by the browser's
Same-Origin Policy — any website can open `new WebSocket("wss://yourapi/...")`
and the cookie-authenticated handshake still goes through (cross-site
WebSocket hijacking). We mirror the same allow-list used by CORSMiddleware
in main.py so a WS connection is held to the same origin policy as the
REST API.
"""

from jose import JWTError
from fastapi import WebSocket, WebSocketException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.db.models.user import User
from app.repositories.user_repo import get_user_by_id

_ALLOWED_ORIGINS = {settings.FRONTEND_URL, "http://localhost:3000"}


async def authenticate_websocket(websocket: WebSocket, db: AsyncSession) -> User:
    origin = websocket.headers.get("origin")
    if origin and origin not in _ALLOWED_ORIGINS:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Origin not allowed")

    # Cookie first (normal browser flow); query param fallback for testing
    # tools (wscat, Postman) that don't carry browser cookies.
    token = websocket.cookies.get("access_token") or websocket.query_params.get("token")
    if not token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Missing auth token")

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token type")
    except JWTError:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")

    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="User not found or inactive")

    return user