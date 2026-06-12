from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from authlib.integrations.httpx_client import AsyncOAuth2Client
from typing import Annotated

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.core.dependencies import get_db
from app.db.models import OAuthProvider
from app.repositories.user_repo import get_user_by_oauth, upsert_oauth_user

router = APIRouter(prefix="/auth", tags=["oauth"])

GOOGLE_CONF = {
    "client_id": settings.GOOGLE_CLIENT_ID,
    "client_secret": settings.GOOGLE_CLIENT_SECRET,
    "server_metadata_url": "https://accounts.google.com/.well-known/openid-configuration",
    "redirect_uri": f"{settings.OAUTH_REDIRECT_BASE_URL}/auth/google/callback",
}


@router.get("/google/login")
async def google_login():
    client = AsyncOAuth2Client(
        client_id=GOOGLE_CONF["client_id"],
        redirect_uri=GOOGLE_CONF["redirect_uri"],
    )
    uri, state = client.create_authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth",
        scope="openid email profile",
    )
    # In production: store state in Redis to verify on callback (CSRF protection)
    return RedirectResponse(uri)


@router.get("/google/callback")
async def google_callback(code: str, db: Annotated[AsyncSession, Depends(get_db)]):
    client = AsyncOAuth2Client(
        client_id=GOOGLE_CONF["client_id"],
        client_secret=GOOGLE_CONF["client_secret"],
        redirect_uri=GOOGLE_CONF["redirect_uri"],
    )
    # Exchange code for tokens
    token = await client.fetch_token(
        "https://oauth2.googleapis.com/token", code=code
    )
    # Get user info from Google
    resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo")
    profile = resp.json()

    # Upsert: find existing user by google ID, or create new one
    user = await upsert_oauth_user(db, {
        "email": profile["email"],
        "full_name": profile.get("name", ""),
        "oauth_provider": OAuthProvider.GOOGLE,
        "oauth_provider_id": profile["sub"],  # Google's unique user ID
    })

    access_token = create_access_token(str(user.id), user.role.value)
    refresh_token = create_refresh_token(str(user.id))

    # Redirect to frontend with tokens in query params
    # In production: use httpOnly cookies instead for better security
    frontend_url = (
        f"{settings.FRONTEND_URL}/auth/callback"
        f"?access_token={access_token}&refresh_token={refresh_token}"
    )
    return RedirectResponse(frontend_url)