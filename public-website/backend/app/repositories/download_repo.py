"""
app/repositories/download_repo.py
───────────────────────────────────
Data access layer for the Download entity.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.download import Download


class DownloadRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        release_id: uuid.UUID,
        download_source: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Download:
        download = Download(
            download_id=uuid.uuid4(),
            user_id=user_id,
            release_id=release_id,
            download_source=download_source,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self._session.add(download)
        await self._session.flush()
        await self._session.refresh(download)
        return download

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Download], int]:
        count_result = await self._session.execute(
            select(func.count(Download.download_id)).where(
                Download.user_id == user_id
            )
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(Download)
            .where(Download.user_id == user_id)
            .order_by(Download.downloaded_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def count_recent_for_user(
        self,
        user_id: uuid.UUID,
        release_id: uuid.UUID,
        *,
        within_minutes: int = 60,
    ) -> int:
        """Rate-abuse check: count downloads for same user/release combo recently."""
        from datetime import datetime, timedelta, timezone

        since = datetime.now(tz=timezone.utc) - timedelta(minutes=within_minutes)
        result = await self._session.execute(
            select(func.count(Download.download_id)).where(
                Download.user_id == user_id,
                Download.release_id == release_id,
                Download.downloaded_at >= since,
            )
        )
        return result.scalar_one()
