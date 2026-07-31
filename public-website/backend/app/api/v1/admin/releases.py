"""
app/api/v1/admin/releases.py
──────────────────────────────
Admin-only release management API routes.
Requires ADMIN or SUPER_ADMIN role.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.release import (
    CreateReleaseRequest,
    ReleaseAdminResponse,
    UpdateReleaseRequest,
)
from app.services.release_service import ReleaseService

router = APIRouter(prefix="/admin/releases", tags=["Admin — Releases"])

_admin_dep = Depends(require_admin)


@router.get(
    "",
    response_model=PaginatedResponse[ReleaseAdminResponse],
    status_code=status.HTTP_200_OK,
    summary="[Admin] List all releases (all statuses)",
    dependencies=[_admin_dep],
)
async def admin_list_releases(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> PaginatedResponse[ReleaseAdminResponse]:
    service = ReleaseService(db)
    return await service.list_all_admin(page=page, page_size=page_size)


@router.post(
    "",
    response_model=ReleaseAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Create a new release",
)
async def create_release(
    request: Request,
    body: CreateReleaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> ReleaseAdminResponse:
    service = ReleaseService(db)
    return await service.create(
        body,
        actor_id=current_user.user_id,
        request_id=getattr(request.state, "request_id", None),
    )


@router.patch(
    "/{release_id}",
    response_model=ReleaseAdminResponse,
    status_code=status.HTTP_200_OK,
    summary="[Admin] Update a release",
)
async def update_release(
    request: Request,
    release_id: uuid.UUID,
    body: UpdateReleaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> ReleaseAdminResponse:
    service = ReleaseService(db)
    return await service.update(
        release_id,
        body,
        actor_id=current_user.user_id,
        request_id=getattr(request.state, "request_id", None),
    )


@router.delete(
    "/{release_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
    summary="[Admin] Delete a release",
)
async def delete_release(
    request: Request,
    release_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    service = ReleaseService(db)
    await service.delete(
        release_id,
        actor_id=current_user.user_id,
        request_id=getattr(request.state, "request_id", None),
    )
