import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from app.db.models import UserRole
from app.db.models.user import OAuthProvider

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole  # CANDIDATE or EMPLOYER only; ADMIN is created manually

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    # Password change
    current_password: Optional[str] = None   # required if user already has a password
    new_password: Optional[str] = None

class SelectRoleRequest(BaseModel):          # NEW
    role: UserRole

class OAuthAccountResponse(BaseModel):        # NEW
    id: uuid.UUID
    provider: OAuthProvider
    provider_email: str
    created_at: datetime

    model_config = {"from_attributes": True}