"""
app/services/release_service.py
────────────────────────────────
Business logic for the Release entity.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.release_repo import ReleaseRepository
from app.schemas.release import (
    CreateReleaseRequest,
    ReleaseAdminResponse,
    ReleasePublicResponse,
    UpdateReleaseRequest,
)
from app.models.release import ReleaseStatus
from app.utils.audit import log_admin_action
from app.utils.pagination import build_paginated_response
from app.schemas.common import PaginatedResponse


class ReleaseService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._release_repo = ReleaseRepository(session)

    async def list_published(
        self, *, page: int, page_size: int
    ) -> PaginatedResponse[ReleasePublicResponse]:
        releases, total = await self._release_repo.list_published(
            offset=(page - 1) * page_size, limit=page_size
        )
        items = [ReleasePublicResponse.model_validate(r) for r in releases]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )

    async def get_latest(self) -> ReleasePublicResponse:
        from fastapi import HTTPException

        release = await self._release_repo.get_latest()
        if not release:
            raise HTTPException(status_code=404, detail="No latest release found.")
        return ReleasePublicResponse.model_validate(release)

    async def get_public(self, release_id: uuid.UUID) -> ReleasePublicResponse:
        from fastapi import HTTPException

        release = await self._release_repo.get_by_id(release_id)
        if not release or release.release_status != ReleaseStatus.PUBLISHED:
            raise HTTPException(status_code=404, detail="Release not found.")
        return ReleasePublicResponse.model_validate(release)

    # ── Admin ─────────────────────────────────────────────────────────────────

    async def create(
        self,
        request: CreateReleaseRequest,
        *,
        actor_id: uuid.UUID,
        request_id: Optional[str] = None,
    ) -> ReleaseAdminResponse:
        from fastapi import HTTPException

        if await self._release_repo.version_exists(request.version):
            raise HTTPException(
                status_code=409, detail=f"Version {request.version!r} already exists."
            )

        # If being published immediately, set published_at
        published_at = request.published_at
        if request.release_status == ReleaseStatus.PUBLISHED and not published_at:
            published_at = datetime.now(tz=timezone.utc)

        release = await self._release_repo.create(
            version=request.version,
            title=request.title,
            description=request.description,
            release_notes=request.release_notes,
            file_path=request.file_path,
            file_size=request.file_size,
            sha256_checksum=request.sha256_checksum,
            published_by_user_id=actor_id,
            release_status=request.release_status,
            is_latest=False,
            published_at=published_at,
        )
        await self._session.commit()

        log_admin_action(
            event="create_release",
            actor_id=str(actor_id),
            target_type="Release",
            target_id=str(release.release_id),
            outcome="success",
            changes={"version": request.version},
            request_id=request_id,
        )

        return ReleaseAdminResponse.model_validate(release)

    async def update(
        self,
        release_id: uuid.UUID,
        request: UpdateReleaseRequest,
        *,
        actor_id: uuid.UUID,
        request_id: Optional[str] = None,
    ) -> ReleaseAdminResponse:
        from fastapi import HTTPException

        release = await self._release_repo.get_by_id(release_id)
        if not release:
            raise HTTPException(status_code=404, detail="Release not found.")

        updates = request.model_dump(exclude_none=True)

        # Handle is_latest promotion
        if updates.get("is_latest"):
            await self._release_repo.clear_is_latest()

        # If transitioning to PUBLISHED, record the time
        if (
            updates.get("release_status") == ReleaseStatus.PUBLISHED
            and not release.published_at
        ):
            updates["published_at"] = datetime.now(tz=timezone.utc)

        updated = await self._release_repo.update_fields(release_id, **updates)
        await self._session.commit()

        log_admin_action(
            event="update_release",
            actor_id=str(actor_id),
            target_type="Release",
            target_id=str(release_id),
            outcome="success",
            changes=updates,
            request_id=request_id,
        )

        return ReleaseAdminResponse.model_validate(updated)

    async def delete(
        self,
        release_id: uuid.UUID,
        *,
        actor_id: uuid.UUID,
        request_id: Optional[str] = None,
    ) -> None:
        from fastapi import HTTPException

        deleted = await self._release_repo.delete(release_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Release not found.")
        await self._session.commit()

        log_admin_action(
            event="delete_release",
            actor_id=str(actor_id),
            target_type="Release",
            target_id=str(release_id),
            outcome="success",
            request_id=request_id,
        )

    async def list_all_admin(
        self, *, page: int, page_size: int
    ) -> PaginatedResponse[ReleaseAdminResponse]:
        releases, total = await self._release_repo.list_all(
            offset=(page - 1) * page_size, limit=page_size
        )
        items = [ReleaseAdminResponse.model_validate(r) for r in releases]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )
