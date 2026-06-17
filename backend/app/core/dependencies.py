from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.db.models import User, UserRole
from app.repositories.user_repo import get_user_by_id

bearer_scheme = HTTPBearer()

"""

## 1. Authentication: get_current_user
OUTDATED DESCRIPTION, the function NOW checks both the Authorization header and the HttpOnly cookie for the access token. It also now checks that the token is an access token, not a refresh token.

------

This function intercepts incoming requests, strips away the security headers, and verifies the user.
Here is the step-by-step pipeline it runs on every request:
- **Extracts the Token**: It looks for an `Authorization: Bearer <token>` header in the HTTP request via HTTPBearer().

- **Decodes and Validates**: It decodes the JWT (JSON Web Token). If the token is expired, fake, structurally broken, 
or happens to be a refresh token instead of an access token, it throws a 401 Unauthorized error immediately.

- **Fetches the User**: It grabs the user ID (`sub`) from inside the token and queries your database (get_user_by_id).

- **Status Check**: It verifies the user actually exists and that their account isn't banned or deactivated 
(`user.is_active`). If everything checks out, it passes the User database object down the line.
"""
async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request, # Inject the HTTP request context
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))] = None,
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = None

    # 1. Primary check: Try to extract token from standard Authorization header
    if credentials:
        token = credentials.credentials
        
    # 2. Secondary fallback: Look for our Next.js browser HttpOnly session cookie
    if not token:
        token = request.cookies.get("access_token")

    # If the token is missing from both locations, boot them out
    if not token:
        raise credentials_exception

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":  # reject refresh tokens used as access tokens
            raise credentials_exception
        user_id: str = str(payload.get("sub"))
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise credentials_exception
        
    return user

"""
Authorization (RBAC): require_role
This is a Role-Based Access Control (RBAC) factory. It's a function that returns another function (role_checker).

Instead of writing custom code for admins, employers, and candidates everywhere, you just pass the allowed roles into this factory. It checks the current_user fetched by the first step:

If the user's role (e.g., "CANDIDATE") matches the required roles, they are allowed through.

If it doesn't match, it immediately stops the request and returns a 403 Forbidden error (e.g., "Access denied. Required roles: ['admin', 'employer']").
"""
def require_role(*roles: UserRole):
    """
    Usage:  Depends(require_role(UserRole.ADMIN, UserRole.EMPLOYER))
    Returns the current user if their role matches, 403 otherwise.
    """
    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in roles]}",
            )
        return current_user
    return role_checker


"""
This is the piece that makes RBAC clean throughout the whole app. In any route you write later, you just do:
@router.get("/jobs")
async def list_jobs(user: EmployerUser):  # one line, fully protected
"""
# Convenience aliases - use these in your route handlers
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser   = Annotated[User, Depends(require_role(UserRole.ADMIN))]
EmployerUser = Annotated[User, Depends(require_role(UserRole.EMPLOYER, UserRole.ADMIN))]
CandidateUser = Annotated[User, Depends(require_role(UserRole.CANDIDATE))]