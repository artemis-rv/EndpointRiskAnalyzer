"""
app/api/v1/admin/users.py
──────────────────────────
Admin-only user administration.

Every route requires the ADMIN role, enforced server-side by `require_admin`.
The frontend's admin routing is a convenience; this dependency is the boundary.

The response schema is `UserPublicResponse`, the same one the account endpoint
returns. It carries no password hash, no verification token and no session
material, so widening the audience from "the user themselves" to "an admin" does
not widen what is exposed about them.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.user import UserPublicResponse
from app.services.user_service import UserService

router = APIRouter(prefix="/admin/users", tags=["Admin — Users"])


@router.get(
    "",
    response_model=PaginatedResponse[UserPublicResponse],
    status_code=status.HTTP_200_OK,
    summary="[Admin] List registered accounts",
)
async def admin_list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    role: Optional[UserRole] = Query(
        default=None, description="Filter by role"
    ),
    search: Optional[str] = Query(
        default=None,
        max_length=255,
        description="Match against name, email or company",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> PaginatedResponse[UserPublicResponse]:
    service = UserService(db)
    return await service.list_all_admin(
        page=page, page_size=page_size, role=role, search=search
    )
