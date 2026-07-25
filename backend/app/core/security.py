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

def verify_password(plain: str, hashed: Optional[str]) -> bool:
    """Verifies a plain-text password against an Argon2id hash.
    Returns False (not an exception) for OAuth-only accounts with no
    password set — was previously an uncaught TypeError."""
    if not hashed:
        return False
    try:
        return ph.verify(hashed, plain)
    except VerifyMismatchError:
        return False

def create_access_token(user_id: str, role: Optional[str], user_data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {
            "sub": user_id,
            "role": role,          # may be None for a role-less OAuth signup
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

def create_oauth_pending_token(
    provider: str, provider_account_id: str, email: str, full_name: str
) -> str:
    """
    Carries an OAuth profile through the role-selection step for a
    brand-new signup, before any User row exists. Deliberately NOT tied to
    a user id — there isn't one yet. Short expiry since this only needs to
    survive one redirect + one form submission.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    return jwt.encode(
        {
            "provider": provider,
            "provider_account_id": provider_account_id,
            "email": email,
            "full_name": full_name,
            "type": "oauth_pending",
            "exp": expire,
        },
        settings.JWT_SECRET_KEY.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM,
    )