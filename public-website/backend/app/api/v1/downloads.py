"""
app/api/v1/downloads.py
────────────────────────
Download tracking API routes.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_verified
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.download import CreateDownloadRequest, DownloadResponse
from app.services.download_service import DownloadService

router = APIRouter(prefix="/downloads", tags=["Downloads"])


def _get_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "",
    response_model=DownloadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a software download",
    description="Requires authenticated, email-verified user. Max 5 downloads per release per hour.",
)
async def create_download(
    request: Request,
    body: CreateDownloadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified),
) -> DownloadResponse:
    service = DownloadService(db)
    return await service.create_download(
        body,
        user_id=current_user.user_id,
        ip_address=_get_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:512],
        request_id=getattr(request.state, "request_id", None),
    )


@router.get(
    "/me",
    response_model=PaginatedResponse[DownloadResponse],
    status_code=status.HTTP_200_OK,
    summary="List my download history",
)
async def list_my_downloads(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified),
) -> PaginatedResponse[DownloadResponse]:
    service = DownloadService(db)
    return await service.list_my_downloads(
        current_user.user_id, page=page, page_size=page_size
    )
