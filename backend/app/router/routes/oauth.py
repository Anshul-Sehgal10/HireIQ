"""
OAuth2 routes — Google and LinkedIn.

Flow for both providers:
1. GET /auth/{provider}/login      → redirect user to provider's consent screen
2. GET /auth/{provider}/callback   → exchange code, upsert user, issue JWT, redirect to frontend

Security:
- State parameter is generated per request and stored in a short-lived cookie.
  On callback, the state in the query param must match the cookie — this
  prevents CSRF attacks where an attacker tricks the user into authorising
  with the attacker's account.
"""

import secrets
from typing import Annotated

from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token, create_refresh_token
from app.db.models.user import OAuthProvider
from app.repositories.user_repo import upsert_oauth_user

router = APIRouter(prefix="/auth", tags=["oauth"])

# ---------------------------------------------------------------------------
# Provider configs
# ---------------------------------------------------------------------------

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
        "userinfo_url": "https://api.linkedin.com/v2/userinfo",  # OpenID Connect endpoint
        "scopes": "openid profile email",
        "provider_enum": OAuthProvider.LINKEDIN,
    },
}


def get_redirect_uri(provider: str) -> str:
    return f"{settings.OAUTH_REDIRECT_BASE_URL}api/v1/auth/{provider}/callback"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_redirect_to_frontend(access_token: str, refresh_token: str, error: str | None = None) -> str:
    """
    Redirects to the Next.js /auth/callback page.

    In a production app you'd set httpOnly cookies here instead of
    query params. For now, query params are fine for development.
    The frontend should immediately move these into memory / secure storage
    and clear them from the URL bar.
    """
    base = f"{settings.FRONTEND_URL}/auth/callback"
    if error:
        return f"{base}?error={error}"
    return f"{base}?access_token={access_token}&refresh_token={refresh_token}"


# ---------------------------------------------------------------------------
# Generic login initiator — works for any provider
# ---------------------------------------------------------------------------


@router.get("/{provider}/login")
async def oauth_login(provider: str, request: Request):
    """
    Redirects the user to the OAuth provider's consent page.
    Sets a short-lived state cookie to verify on callback (CSRF protection).
    """
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")

    conf = PROVIDERS[provider]

    if not conf["client_id"] or not conf["client_secret"]:
        raise HTTPException(
            status_code=503,
            detail=f"{provider.title()} OAuth is not configured on this server",
        )

    # Generate a random state token — this is the CSRF protection
    state = secrets.token_urlsafe(32)

    client = AsyncOAuth2Client(
        client_id=conf["client_id"],
        redirect_uri=get_redirect_uri(provider),
        scope=conf["scopes"],
    )

    authorization_url, _ = client.create_authorization_url(
        conf["authorize_url"],
        state=state,
    )

    response = RedirectResponse(authorization_url)

    # Store state in a short-lived, httpOnly cookie — expires in 10 minutes
    response.set_cookie(
        key=f"oauth_state_{provider}",
        value=state,
        max_age=600,        # 10 minutes
        httponly=True,      # not accessible via JS
        secure=not settings.DEBUG,       # set to True in production (HTTPS only)
        samesite="lax",     # allows the redirect back to carry the cookie
    )

    return response


# ---------------------------------------------------------------------------
# Generic callback handler — works for any provider
# ---------------------------------------------------------------------------


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    """
    Called by the OAuth provider after the user consents.

    Steps:
    1. Verify state cookie matches query param (CSRF check)
    2. Exchange code for access token
    3. Fetch user profile from provider
    4. Upsert user in our DB
    5. Issue our own JWT pair
    6. Redirect to frontend with tokens
    """
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")

    # Handle provider-level errors (e.g. user denied consent)
    if error:
        redirect_url = _build_redirect_to_frontend("", "", error=f"oauth_denied_{provider}")
        return RedirectResponse(redirect_url)

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    # --- CSRF check ---
    stored_state = request.cookies.get(f"oauth_state_{provider}")
    if not stored_state or stored_state != state:
        raise HTTPException(
            status_code=400,
            detail="State mismatch — possible CSRF attack. Please try logging in again.",
        )

    conf = PROVIDERS[provider]

    try:
        # --- Exchange code for token ---
        client = AsyncOAuth2Client(
            client_id=conf["client_id"],
            client_secret=conf["client_secret"],
            redirect_uri=get_redirect_uri(provider),
        )

        await client.fetch_token(conf["token_url"], code=code)

        # --- Fetch user profile ---
        resp = await client.get(conf["userinfo_url"])
        resp.raise_for_status()
        profile = resp.json()

    except Exception as exc:
        print(f"OAuth error ({provider}): {exc}")
        redirect_url = _build_redirect_to_frontend("", "", error="oauth_failed")
        response = RedirectResponse(redirect_url)
        response.delete_cookie(f"oauth_state_{provider}")
        return response

    # --- Extract fields (Google and LinkedIn return slightly different shapes) ---
    user_data = _extract_user_data(provider, profile, conf["provider_enum"])

    # --- Upsert in DB ---
    user = await upsert_oauth_user(db, user_data)

    # --- Issue our JWT pair ---
    access_token = create_access_token(str(user.id), user.role.value)
    refresh_token = create_refresh_token(str(user.id))

    redirect_url = _build_redirect_to_frontend(access_token, refresh_token)
    response = RedirectResponse(redirect_url)

    # Clear the state cookie — it's single-use
    response.delete_cookie(f"oauth_state_{provider}")

    return response


# ---------------------------------------------------------------------------
# Provider-specific profile extraction
# ---------------------------------------------------------------------------


def _extract_user_data(provider: str, profile: dict, provider_enum: OAuthProvider) -> dict:
    """
    Normalises the user profile from any provider into the shape
    that upsert_oauth_user expects.

    Google returns:  { sub, email, name, given_name, family_name, picture }
    LinkedIn OpenID: { sub, email, name, given_name, family_name, picture }
    (LinkedIn's OpenID Connect endpoint returns the same shape as Google —
     that's the whole point of using the OpenID endpoint over the older v2 API)
    """
    email = profile.get("email", "").lower().strip()
    if not email:
        raise HTTPException(
            status_code=400,
            detail=f"Could not retrieve email from {provider}. "
                   "Please ensure your {provider} account has a verified email.",
        )

    return {
        "email": email,
        "full_name": profile.get("name") or (
            f"{profile.get('given_name', '')} {profile.get('family_name', '')}".strip()
        ),
        "oauth_provider": provider_enum,
        "oauth_provider_id": profile.get("sub"),   # 'sub' is standard in OpenID Connect
        "is_verified": True,
    }