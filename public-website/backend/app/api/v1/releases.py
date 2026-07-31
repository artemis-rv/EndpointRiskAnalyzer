"""
app/api/v1/releases.py
───────────────────────
Public release browsing API routes (no auth required).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.common import PaginatedResponse
from app.schemas.release import ReleasePublicResponse
from app.services.release_service import ReleaseService

router = APIRouter(prefix="/releases", tags=["Releases"])


@router.get(
    "",
    response_model=PaginatedResponse[ReleasePublicResponse],
    status_code=status.HTTP_200_OK,
    summary="List all published releases",
)
async def list_releases(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[ReleasePublicResponse]:
    # FINDING-RE-001 (INFO): Wrap DB call to return 503 instead of unhandled 500
    # when the data layer is unavailable (e.g., missing DB enum type, connection loss).
    try:
        service = ReleaseService(db)
        return await service.list_published(page=page, page_size=page_size)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Releases data is temporarily unavailable. Please try again later.",
        )


@router.get(
    "/latest",
    response_model=ReleasePublicResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the latest published release",
)
async def get_latest_release(
    db: AsyncSession = Depends(get_db),
) -> ReleasePublicResponse:
    service = ReleaseService(db)
    return await service.get_latest()


@router.get(
    "/{release_id}",
    response_model=ReleasePublicResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a specific published release by ID",
)
async def get_release(
    release_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ReleasePublicResponse:
    service = ReleaseService(db)
    return await service.get_public(release_id)
