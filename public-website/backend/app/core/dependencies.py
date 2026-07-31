"""
app/core/dependencies.py
─────────────────────────
FastAPI dependency injection for authentication and authorization.

Design:
- get_current_user: validates JWT and returns the authenticated user model
- require_verified: additionally asserts email is verified
- require_role: factory for role-based access control
- All dependencies are reusable across any route handler
- Roles are checked server-side ONLY — never trust client-supplied role claims
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole
from app.repositories.user_repo import UserRepository

_bearer = HTTPBearer(auto_error=False)

_ROLE_HIERARCHY: dict[UserRole, int] = {
    UserRole.USER: 0,
    UserRole.ADMIN: 1,
    UserRole.SUPER_ADMIN: 2,
}

# Shared 401 for all authentication failures — consistent message prevents enumeration
_AUTH_REQUIRED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentication required.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate the Bearer JWT and return the authenticated User model.
    Raises 401 on any authentication failure — including a missing token.
    (FINDING-VA-003 — LOW: missing token must return 401, not 403)
    """
    # Missing token: HTTPBearer with auto_error=False returns None
    if not credentials:
        raise _AUTH_REQUIRED

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id_str: Optional[str] = payload.get("sub")
        if not user_id_str:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)

    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    return user


async def require_verified(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Asserts the authenticated user has verified their email.
    Used on sensitive endpoints (e.g., downloads).
    """
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required.",
        )
    return current_user


def require_role(minimum_role: UserRole):
    """
    Dependency factory that enforces a minimum role level.

    Usage:
        @router.get("/admin/...", dependencies=[Depends(require_role(UserRole.ADMIN))])
    """

    async def _check(
        current_user: User = Depends(get_current_user),
    ) -> User:
        user_level = _ROLE_HIERARCHY.get(current_user.role, -1)
        required_level = _ROLE_HIERARCHY.get(minimum_role, 999)
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions.",
            )
        return current_user

    return _check


# ── Convenience aliases ───────────────────────────────────────────────────────
require_admin = require_role(UserRole.ADMIN)
require_super_admin = require_role(UserRole.SUPER_ADMIN)
