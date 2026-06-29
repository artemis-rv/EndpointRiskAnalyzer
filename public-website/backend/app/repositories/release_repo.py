"""
app/repositories/release_repo.py
──────────────────────────────────
Data access layer for the Release entity.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.release import Release, ReleaseStatus


class ReleaseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, release_id: uuid.UUID) -> Optional[Release]:
        result = await self._session.execute(
            select(Release).where(Release.release_id == release_id)
        )
        return result.scalar_one_or_none()

    async def get_by_version(self, version: str) -> Optional[Release]:
        result = await self._session.execute(
            select(Release).where(Release.version == version)
        )
        return result.scalar_one_or_none()

    async def version_exists(self, version: str) -> bool:
        result = await self._session.execute(
            select(Release.release_id).where(Release.version == version)
        )
        return result.scalar_one_or_none() is not None

    async def get_latest(self) -> Optional[Release]:
        result = await self._session.execute(
            select(Release)
            .where(
                Release.is_latest == True,
                Release.release_status == ReleaseStatus.PUBLISHED,
            )
        )
        return result.scalar_one_or_none()

    async def list_published(
        self, *, offset: int = 0, limit: int = 20
    ) -> Tuple[List[Release], int]:
        """Returns (releases, total_count) for published releases only."""
        base_filter = Release.release_status == ReleaseStatus.PUBLISHED

        count_result = await self._session.execute(
            select(func.count(Release.release_id)).where(base_filter)
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(Release)
            .where(base_filter)
            .order_by(Release.published_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def list_all(
        self, *, offset: int = 0, limit: int = 20
    ) -> Tuple[List[Release], int]:
        """Admin: returns all releases regardless of status."""
        count_result = await self._session.execute(
            select(func.count(Release.release_id))
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(Release)
            .order_by(Release.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def create(
        self,
        *,
        version: str,
        title: str,
        description: Optional[str],
        release_notes: str,
        file_path: str,
        file_size: int,
        sha256_checksum: str,
        published_by_user_id: uuid.UUID,
        release_status: ReleaseStatus = ReleaseStatus.DRAFT,
        is_latest: bool = False,
        published_at=None,
    ) -> Release:
        release = Release(
            release_id=uuid.uuid4(),
            version=version,
            title=title,
            description=description,
            release_notes=release_notes,
            file_path=file_path,
            file_size=file_size,
            sha256_checksum=sha256_checksum,
            published_by_user_id=published_by_user_id,
            release_status=release_status,
            is_latest=is_latest,
            published_at=published_at,
        )
        self._session.add(release)
        await self._session.flush()
        await self._session.refresh(release)
        return release

    async def update_fields(
        self, release_id: uuid.UUID, **fields: object
    ) -> Optional[Release]:
        await self._session.execute(
            update(Release)
            .where(Release.release_id == release_id)
            .values(**fields)
        )
        return await self.get_by_id(release_id)

    async def clear_is_latest(self) -> None:
        """Unset is_latest on all releases (before setting a new one)."""
        await self._session.execute(
            update(Release).values(is_latest=False)
        )

    async def delete(self, release_id: uuid.UUID) -> bool:
        release = await self.get_by_id(release_id)
        if not release:
            return False
        await self._session.delete(release)
        await self._session.flush()
        return True
