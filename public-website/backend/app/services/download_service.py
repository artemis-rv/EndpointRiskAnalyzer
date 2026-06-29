"""
app/services/download_service.py
──────────────────────────────────
Business logic for download tracking.
"""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.release import ReleaseStatus
from app.repositories.download_repo import DownloadRepository
from app.repositories.release_repo import ReleaseRepository
from app.repositories.user_repo import UserRepository
from app.schemas.common import PaginatedResponse
from app.schemas.download import CreateDownloadRequest, DownloadResponse
from app.utils.audit import log_download_event
from app.utils.pagination import build_paginated_response


class DownloadService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._download_repo = DownloadRepository(session)
        self._release_repo = ReleaseRepository(session)
        self._user_repo = UserRepository(session)

    async def create_download(
        self,
        request: CreateDownloadRequest,
        *,
        user_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> DownloadResponse:
        from fastapi import HTTPException

        # Verify user exists and has verified email
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        if not user.email_verified:
            raise HTTPException(
                status_code=403,
                detail="Email verification required before downloading.",
            )

        # Verify release exists and is published
        release = await self._release_repo.get_by_id(request.release_id)
        if not release or release.release_status != ReleaseStatus.PUBLISHED:
            raise HTTPException(status_code=404, detail="Release not found.")

        # Abuse prevention: max 5 downloads of same release per hour per user
        recent_count = await self._download_repo.count_recent_for_user(
            user_id, request.release_id, within_minutes=60
        )
        if recent_count >= 5:
            raise HTTPException(
                status_code=429,
                detail="Too many download requests. Please try again later.",
            )

        download = await self._download_repo.create(
            user_id=user_id,
            release_id=request.release_id,
            download_source=request.download_source,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        await self._session.commit()

        log_download_event(
            actor_id=str(user_id),
            release_id=str(release.release_id),
            release_version=release.version,
            ip_address=ip_address,
            outcome="success",
            request_id=request_id,
        )

        return DownloadResponse.model_validate(download)

    async def list_my_downloads(
        self, user_id: uuid.UUID, *, page: int, page_size: int
    ) -> PaginatedResponse[DownloadResponse]:
        downloads, total = await self._download_repo.list_by_user(
            user_id, offset=(page - 1) * page_size, limit=page_size
        )
        items = [DownloadResponse.model_validate(d) for d in downloads]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )
