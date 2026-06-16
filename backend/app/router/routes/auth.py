from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_db
from app.core.config import settings
from app.core.security import (
    create_access_token, create_refresh_token,
    decode_token, hash_password, verify_password,
)
from app.db.models import User, UserRole
from app.repositories.user_repo import get_user_by_email, create_user, get_user_by_id
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, RefreshRequest
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])

# Helper function to inject cookies into responses
def set_auth_cookies(response: Response, access_token: str):
    # 1. Clear out any old, stale cookies explicitly first
    response.delete_cookie(key="access_token", path="/")
    
    # 2. Set the fresh, new role token cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,        # Protects against XSS
        secure=not settings.DEBUG,  # Allow local HTTP dev while keeping production cookie transport secure
        samesite="lax",       # Protects against CSRF
        path="/",             # CRITICAL: Must be root so all dashboard routes can clear/read it
        max_age=60 * 60 * 24  # 24 hours
    )

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = await create_user(db, {
        "email": body.email,
        "hashed_password": hash_password(body.password),
        "full_name": body.full_name,
        "role": body.role,   # CANDIDATE or EMPLOYER
    })

    return {"message": "Account created."}


@router.post("/login", response_model=TokenResponse)
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
    refresh_token = create_refresh_token(user_id=str(user.id))

    # 4. Drop the cookie straight into the client header
    set_auth_cookies(response, access_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest, 
    response: Response,  # Inject response context here too
    db: Annotated[AsyncSession, Depends(get_db)]
):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
            
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # 1. Fetch user from DB using the 'sub' claim
    user = await get_user_by_id(db, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # 2. Shape the user_data payload
    user_data = {
        "email": user.email,
        "full_name": user.full_name  
    }

    # 3. Generate brand new token pair
    new_access_token = create_access_token(
        user_id=str(user.id), 
        role=user.role.value, 
        user_data=user_data
    )
    new_refresh_token = create_refresh_token(user_id=str(user.id))

    # 4. Refresh the cookie with the updated token values
    set_auth_cookies(response, new_access_token)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )


@router.get("/me")
async def me(user: CurrentUser):
    return {"id": str(user.id), "email": user.email, "role": user.role, "name": user.full_name}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response