"""
OAuth2 routes — Google and LinkedIn.

Two independent flows share the same provider config:

1. Login/signup — GET /auth/{provider}/login → GET /auth/{provider}/callback
   Unauthenticated. Implements the 3-step upsert algorithm in user_repo.py.
   A brand-new signup (role still None) is redirected to the frontend's
   role-selection page instead of the normal post-login callback page.

2. Connect — GET /auth/{provider}/connect → GET /auth/{provider}/connect/callback
   Requires an existing session. Links a new provider account to the
   already-logged-in user. Rejects if the external account is already
   linked to someone else, and requires the provider's email to match the
   logged-in user's email (safer default — prevents an unrelated inbox
   from becoming an alternate login path into this account).

Security: both flows use a per-request state cookie under different names
so a login attempt and a connect attempt in overlapping tabs can't clobber
each other's state.
"""
# Types
import secrets
from typing import Annotated

# FastAPI and SQLAlchemy
from authlib.integrations.httpx_client import AsyncOAuth2Client # OAuth client by authlib
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

# Core modules
from app.core.config import settings
from app.core.dependencies import CurrentUser, get_db
from app.core.security import create_access_token, create_refresh_token, create_oauth_pending_token

# Database models
from app.db.models.user import OAuthProvider

# Repository and CRUD functions
from app.repositories import oauth_repo
from app.repositories.user_repo import find_existing_oauth_user


router = APIRouter(prefix="/auth", tags=["oauth"])

PROVIDERS = {
    "google": {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET.get_secret_value(),
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scopes": "openid email profile",
        "provider_enum": OAuthProvider.GOOGLE,
    },
    "linkedin": {
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "client_secret": settings.LINKEDIN_CLIENT_SECRET.get_secret_value(),
        "authorize_url": "https://www.linkedin.com/oauth/v2/authorization",
        "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
        "userinfo_url": "https://api.linkedin.com/v2/userinfo",
        "scopes": "openid profile email",
        "provider_enum": OAuthProvider.LINKEDIN,
    },
}


def get_redirect_uri(provider: str, connect: bool = False) -> str:
    base = settings.OAUTH_REDIRECT_BASE_URL.rstrip("/")
    suffix = "connect/callback" if connect else "callback"
    return f"{base}/api/v1/auth/{provider}/{suffix}"


def _build_redirect_to_frontend(path: str = "/auth/callback", error: str | None = None) -> str:
    base = settings.FRONTEND_URL.rstrip("/") + path
    return f"{base}?error={error}" if error else base


def _extract_user_data(provider: str, profile: dict) -> dict:
    email = profile.get("email", "").lower().strip()
    if not email:
        raise HTTPException(
            status_code=400,
            detail=f"Could not retrieve email from {provider}. "
                   "Please ensure your account has a verified email.",
        )
    return {
        "email": email,
        "full_name": profile.get("name") or (
            f"{profile.get('given_name', '')} {profile.get('family_name', '')}".strip()
        ),
        "provider_account_id": profile.get("sub"),
    }


async def _fetch_profile(conf: dict, code: str, redirect_uri: str) -> dict:
    client = AsyncOAuth2Client(
        client_id=conf["client_id"],
        client_secret=conf["client_secret"],
        redirect_uri=redirect_uri,
    )
    await client.fetch_token(conf["token_url"], code=code)
    resp = await client.get(conf["userinfo_url"])  # type: ignore
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Login / signup flow
# ---------------------------------------------------------------------------

@router.get("/{provider}/login")
async def oauth_login(provider: str, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")
    conf = PROVIDERS[provider]
    if not conf["client_id"] or not conf["client_secret"]:
        raise HTTPException(503, f"{provider.title()} OAuth is not configured on this server")

    state = secrets.token_urlsafe(32)
    client = AsyncOAuth2Client(
        client_id=conf["client_id"],
        redirect_uri=get_redirect_uri(provider),
        scope=conf["scopes"],
    )
    authorization_url, _ = client.create_authorization_url(conf["authorize_url"], state=state)

    response = RedirectResponse(authorization_url)
    response.set_cookie(
        key=f"oauth_state_{provider}", value=state, max_age=600,
        httponly=True, secure=not settings.DEBUG, samesite="lax",
    )
    return response


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")

    if error:
        return RedirectResponse(_build_redirect_to_frontend(error=f"oauth_denied_{provider}"))
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    stored_state = request.cookies.get(f"oauth_state_{provider}")
    if not stored_state or stored_state != state:
        raise HTTPException(400, "State mismatch — possible CSRF attack. Please try logging in again.")

    conf = PROVIDERS[provider]
    try:
        profile = await _fetch_profile(conf, code, get_redirect_uri(provider))
    except Exception as exc:
        print(f"OAuth error ({provider}): {exc}")
        response = RedirectResponse(_build_redirect_to_frontend(error="oauth_failed"))
        response.delete_cookie(f"oauth_state_{provider}")
        return response

    user_data = _extract_user_data(provider, profile)
    if not user_data["provider_account_id"]:
        raise HTTPException(400, f"Could not retrieve account ID from {provider}")

    user = await find_existing_oauth_user(
        db, conf["provider_enum"], user_data["provider_account_id"], user_data["email"]
    )

    if user is None:
        # Brand-new signup — no User row created yet. Hand the browser a
        # short-lived pending token instead of real session cookies.
        pending_token = create_oauth_pending_token(
            provider=conf["provider_enum"].value,
            provider_account_id=user_data["provider_account_id"],
            email=user_data["email"],
            full_name=user_data["full_name"],
        )
        response = RedirectResponse(_build_redirect_to_frontend("/select-role"))
        response.set_cookie(
            key="oauth_pending_token", value=pending_token, max_age=900,
            httponly=True, secure=not settings.DEBUG, samesite="lax", path="/",
        )
        response.delete_cookie(f"oauth_state_{provider}")
        return response

    if not user.is_active:
        response = RedirectResponse(_build_redirect_to_frontend(error="account_blocked"))
        response.delete_cookie(f"oauth_state_{provider}")
        return response

    access_token = create_access_token(
        str(user.id), user.role.value, {"email": user.email, "full_name": user.full_name},
    )
    refresh_token = create_refresh_token(str(user.id))
    response = RedirectResponse(_build_redirect_to_frontend("/auth/callback"))

    from app.router.routes.auth import set_refresh_cookie, set_access_cookie
    set_refresh_cookie(response, refresh_token)
    set_access_cookie(response, access_token)
    response.delete_cookie(f"oauth_state_{provider}")
    return response

# ---------------------------------------------------------------------------
# Connect flow — link a provider to an already-logged-in user
# ---------------------------------------------------------------------------

@router.get("/{provider}/connect")
async def oauth_connect(provider: str, user: CurrentUser):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")
    conf = PROVIDERS[provider]
    if not conf["client_id"] or not conf["client_secret"]:
        raise HTTPException(503, f"{provider.title()} OAuth is not configured on this server")

    state = secrets.token_urlsafe(32)
    client = AsyncOAuth2Client(
        client_id=conf["client_id"],
        redirect_uri=get_redirect_uri(provider, connect=True),
        scope=conf["scopes"],
    )
    authorization_url, _ = client.create_authorization_url(conf["authorize_url"], state=state)

    response = RedirectResponse(authorization_url)
    response.set_cookie(
        key=f"oauth_connect_state_{provider}", value=state, max_age=600,
        httponly=True, secure=not settings.DEBUG, samesite="lax",
    )
    return response


@router.get("/{provider}/connect/callback")
async def oauth_connect_callback(
    provider: str,
    request: Request,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")

    if error:
        return RedirectResponse(_build_redirect_to_frontend("/profile", error=f"oauth_denied_{provider}"))
    if not code:
        raise HTTPException(400, "Missing authorization code")

    stored_state = request.cookies.get(f"oauth_connect_state_{provider}")
    if not stored_state or stored_state != state:
        raise HTTPException(400, "State mismatch — possible CSRF attack. Please try connecting again.")

    conf = PROVIDERS[provider]
    try:
        profile = await _fetch_profile(conf, code, get_redirect_uri(provider, connect=True))
    except Exception as exc:
        print(f"OAuth connect error ({provider}): {exc}")
        response = RedirectResponse(_build_redirect_to_frontend("/profile", error="oauth_failed"))
        response.delete_cookie(f"oauth_connect_state_{provider}")
        return response

    user_data = _extract_user_data(provider, profile)
    provider_account_id = user_data["provider_account_id"]
    if not provider_account_id:
        raise HTTPException(400, f"Could not retrieve account ID from {provider}")

    existing = await oauth_repo.get_by_provider_account(db, conf["provider_enum"], provider_account_id)
    if existing:
        if existing.user_id != user.id:
            response = RedirectResponse(_build_redirect_to_frontend("/profile", error="oauth_already_linked"))
            response.delete_cookie(f"oauth_connect_state_{provider}")
            return response
        # Already linked to this same user — treat as a no-op success.
        response = RedirectResponse(_build_redirect_to_frontend(f"/profile?connected={provider}"))
        response.delete_cookie(f"oauth_connect_state_{provider}")
        return response

    if user_data["email"].lower() != user.email.lower():
        response = RedirectResponse(_build_redirect_to_frontend("/profile", error="oauth_email_mismatch"))
        response.delete_cookie(f"oauth_connect_state_{provider}")
        return response

    await oauth_repo.create(db, user.id, conf["provider_enum"], provider_account_id, user_data["email"])

    response = RedirectResponse(_build_redirect_to_frontend(f"/profile?connected={provider}"))
    response.delete_cookie(f"oauth_connect_state_{provider}")
    return response