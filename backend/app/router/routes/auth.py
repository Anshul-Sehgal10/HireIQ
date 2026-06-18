from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_db
from app.core.config import settings
from app.core.security import (
    create_access_token, create_refresh_token,
    decode_token, hash_password, verify_password,
)
from app.db.models import User, UserRole
from app.repositories.user_repo import get_user_by_email, create_user, get_user_by_id
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])

# Helper function to inject cookies into responses
def set_refresh_cookie(response: Response, refresh_token: str):
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
        max_age=60 * 60 * 24 * 30,  # 30 days
    )

# Add this helper alongside set_refresh_cookie:

def set_access_cookie(response: Response, access_token: str):
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
    response.delete_cookie(key="access_token", path="/")

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    response: Response,                          # add this
    db: Annotated[AsyncSession, Depends(get_db)]
):
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
    access_token = create_access_token(str(user.id), user.role.value, user_data)
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
    role=user.role.value,
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
        role=user.role.value,
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
    return {"id": str(user.id), "email": user.email, "role": user.role, "name": user.full_name}


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
            pass  # even if decoding fails, still clear the cookies

    response.delete_cookie(key="refresh_token", path="/")
    clear_access_cookie(response)