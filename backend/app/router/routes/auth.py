"""
Authentication routes.

Provides endpoints for user registration, login, token refresh,
profile management, and logout. Cookie handling and JWT generation
are centralized through helper functions to keep endpoint logic clean.
"""

import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_db
from app.core.config import settings
from app.core.security import (
    create_access_token, create_refresh_token,
    decode_token, hash_password, verify_password,
)
from app.db.models import User, UserRole
from app.repositories import oauth_repo
from app.repositories.user_repo import get_user_by_email, create_user, get_user_by_id, update_user
from app.schemas.auth import (
    LoginRequest, RegisterRequest, UpdateProfileRequest,
    SelectRoleRequest, OAuthAccountResponse,
)
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])

# Helper function to inject cookies into responses
def set_refresh_cookie(response: Response, refresh_token: str):
    """Store the refresh token in a secure HttpOnly cookie.

    Any existing refresh cookie is deleted first to avoid stale values.
    """
    response.delete_cookie(
        key="refresh_token",
        path="/"
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * settings.REFRESH_TOKEN_EXPIRE_DAYS, # 7 days
    )


def set_access_cookie(response: Response, access_token: str):
    """Store the short-lived access token in a browser-readable cookie."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=False,          # JS-readable — middleware and useAuth need to decode it
        secure=not settings.DEBUG,
        samesite="lax",
        path="/",
        max_age=60 * settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )

def clear_access_cookie(response: Response):
    """Remove the access token cookie from the client."""
    response.delete_cookie(key="access_token", path="/")

def _role_value(user: User) -> str | None:
    """user.role is None only for an OAuth signup mid role-selection."""
    return user.role.value if user.role else None

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    response: Response,                          # add this
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Register a new local user and immediately authenticate them by
    issuing access and refresh tokens.
    """
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = await create_user(db, {
        "email": body.email,
        "hashed_password": hash_password(body.password),
        "full_name": body.full_name,
        "role": body.role,
    })

    # Issue tokens immediately — same logic as /login
    user_data = {"email": user.email, "full_name": user.full_name}
    access_token = create_access_token(
    user_id=str(user.id),
    role=_role_value(user),
    user_data=user_data
    )
    refresh_token = create_refresh_token(str(user.id))

    set_refresh_cookie(response, refresh_token)
    set_access_cookie(response, access_token)

    return {"message": "Account created."}


@router.post("/login")
async def login(
    body: LoginRequest, 
    response: Response,  # Inject FastAPI response context to set headers
    db: Annotated[AsyncSession, Depends(get_db)]
):
    # 1. Fetch user from DB by email
    user = await get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.hashed_password): # type: ignore 
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # 2. Shape the user_data dict exactly like the token function expects
    user_data = {
        "email": user.email,
        "full_name": user.full_name
    }

    # 3. Generate token pairs safely
    access_token = create_access_token(
    user_id=str(user.id),
    role=_role_value(user),
    user_data=user_data
    )
    
    refresh_token = create_refresh_token(
        user_id=str(user.id)
    )
    
    # 4. Set the refresh token in an HttpOnly cookie and access token in a regular cookie
    set_refresh_cookie(response, refresh_token)
    set_access_cookie(response, access_token)
    
    return {
        "message": "Login successful",
    }


@router.post("/refresh")
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Annotated[AsyncSession, Depends(get_db)] = None # type: ignore
):
    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail="Missing refresh token"
        )

    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=401,
                detail="Invalid token type"
            )
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )
    
    # Check if token's jti is blacklisted (i.e. revoked)
    from app.repositories.token_repo import is_blacklisted
    jti = payload.get("jti")
    if jti and await is_blacklisted(db, jti):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    # 1. Fetch user from DB using the 'sub' claim
    user = await get_user_by_id(db, payload["sub"])

    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User not found or inactive"
        )

    # 2. Shape the user_data payload
    user_data = {
        "email": user.email,
        "full_name": user.full_name,
    }

    # 3. Generate brand new token pair
    new_access_token = create_access_token(
        user_id=str(user.id),
        role=_role_value(user),
        user_data=user_data
    )

    new_refresh_token = create_refresh_token(
        user_id=str(user.id)
    )

    # 4. Refresh the cookies with the updated token values
    set_refresh_cookie(response, new_refresh_token)
    set_access_cookie(response, new_access_token)

    return {
        "message": "Token refreshed successfully"
    }


@router.get("/me")
async def me(user: CurrentUser):
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "full_name": user.full_name,
        "has_password": user.hashed_password is not None,
    }

@router.patch("/me")
async def update_me(
    body: UpdateProfileRequest,
    response: Response,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    updates = {}
    # --- full_name ---
    if body.full_name is not None:
        updates["full_name"] = body.full_name.strip()

    # --- email ---
    if body.email is not None and body.email.lower() != user.email:
        if not user.hashed_password:
            raise HTTPException(
                400,
                "Your account has no password set yet — set one before changing your "
                "email, since your email is otherwise tied to your connected sign-in provider(s).",
            )
        existing = await get_user_by_email(db, body.email)
        if existing:
            raise HTTPException(400, "Email already in use")
        updates["email"] = body.email.lower().strip()

    # --- password ---
    if body.new_password is not None:
        # If user already has a password, require current_password verification
        if user.hashed_password:
            if not body.current_password:
                raise HTTPException(400, "Current password is required")
            if not verify_password(body.current_password, user.hashed_password):
                raise HTTPException(400, "Current password is incorrect")
        # OAuth user setting password for first time — no verification needed
        updates["hashed_password"] = hash_password(body.new_password)

    if not updates:
        raise HTTPException(400, "No fields to update")

    updated_user = await update_user(db, user.id, updates)

    if not updated_user:
        raise HTTPException(500, "Failed to update user")

    # Re-issue tokens if email or name changed (both are in the JWT payload)
    if "email" in updates or "full_name" in updates:
        user_data = {
            "email": updated_user.email,
            "full_name": updated_user.full_name,
        }
        access_token = create_access_token(
            user_id=str(user.id),
            role=_role_value(user),
            user_data=user_data
        )
        refresh_token = create_refresh_token(str(updated_user.id))
        set_refresh_cookie(response, refresh_token)
        set_access_cookie(response, access_token)

    return {
        "id": str(updated_user.id),
        "email": updated_user.email,
        "full_name": updated_user.full_name,
        "role": updated_user.role,
        "has_password": updated_user.hashed_password is not None,
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(),
    db: Annotated[AsyncSession, Depends(get_db)] = None, #type: ignore
):
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                from datetime import datetime, timezone
                from app.repositories.token_repo import blacklist_token
                expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
                await blacklist_token(db, jti, expires_at)
        except Exception:
            pass
        finally:
            # even if decoding fails, still clear the cookies
            response.delete_cookie(key="refresh_token", path="/")
            clear_access_cookie(response)

# ---------------------------------------------------------------------------
# Role selection — completes an OAuth-only signup
# ---------------------------------------------------------------------------

@router.post("/select-role")
async def select_role(
    body: SelectRoleRequest,
    response: Response,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user.role is not None:
        raise HTTPException(400, "Role has already been set for this account")
    if body.role == UserRole.ADMIN:
        raise HTTPException(400, "Cannot self-assign the admin role")

    user.role = body.role
    await db.commit()
    await db.refresh(user)

    if body.role == UserRole.CANDIDATE:
        from app.db.models.candidate_profiles import CandidateProfile
        existing = await db.execute(
            select(CandidateProfile).where(CandidateProfile.user_id == user.id)
        )
        if not existing.scalar_one_or_none():
            db.add(CandidateProfile(user_id=user.id))
            await db.commit()

    user_data = {"email": user.email, "full_name": user.full_name}
    access_token = create_access_token(
        user_id=str(user.id),
        role=_role_value(user),
        user_data=user_data
    )
    refresh_token = create_refresh_token(str(user.id))
    set_refresh_cookie(response, refresh_token)
    set_access_cookie(response, access_token)

    return {"id": str(user.id), "role": user.role, "message": "Role set successfully"}


# ---------------------------------------------------------------------------
# Linked OAuth accounts
# ---------------------------------------------------------------------------

@router.get("/me/oauth-accounts", response_model=List[OAuthAccountResponse])
async def list_my_oauth_accounts(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await oauth_repo.list_for_user(db, user.id)


@router.delete("/oauth-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_oauth_account(
    account_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await oauth_repo.get_by_id(db, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(404, "Linked account not found")

    remaining = await oauth_repo.list_for_user(db, user.id)
    if len(remaining) <= 1 and not user.hashed_password:
        raise HTTPException(
            400,
            "Cannot unlink your only sign-in method. Set a password first, "
            "or connect another provider before unlinking this one.",
        )

    await oauth_repo.delete(db, account)