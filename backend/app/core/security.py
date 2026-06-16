from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.core.config import settings

# Initialize the Argon2id hasher with secure, production-grade defaults
ph = PasswordHasher()

"""
What's happening here: argon2-cffi hashes passwords with Argon2id (modern, memory-hard standard). 
The JWT has type: access or type: refresh so a refresh token can never be used as an access 
token — a common security mistake. The jti field in the refresh token gives it a unique ID 
so you can invalidate individual sessions later.
"""

def hash_password(password: str) -> str:
    """Hashes a plain-text password using Argon2id."""
    return ph.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    """Verifies a plain-text password against an Argon2id hash."""
    try:
        return ph.verify(hashed, plain)
    except VerifyMismatchError:
        return False

def create_access_token(user_id: str, role: str, user_data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {
            "sub": user_id,
            "role": role,
            "email": user_data["email"],
            "full_name": user_data["full_name"],
            "type": "access",
            "exp": expire,
        },
        settings.JWT_SECRET_KEY.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM,
    )

def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return jwt.encode(
        {
            "sub": user_id,
            "type": "refresh",
            "jti": str(uuid.uuid4()),  # Unique ID for this token, useful for revocation
            "exp": expire,
        },
        settings.JWT_SECRET_KEY.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM,
    )

def decode_token(token: str) -> dict:
    """Raises JWTError if invalid or expired."""
    return jwt.decode(
        token, 
        settings.JWT_SECRET_KEY.get_secret_value(), 
        algorithms=[settings.JWT_ALGORITHM]
    )