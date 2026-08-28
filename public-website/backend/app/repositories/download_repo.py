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

    async def find_recent_for_user(
        self,
        user_id: uuid.UUID,
        release_id: uuid.UUID,
        *,
        within_seconds: int = 120,
    ) -> Optional[Download]:
        """
        Most recent download of this release by this user inside a short window.

        Used to collapse retries. A browser that reconnects, a double click, or
        a resumed transfer would otherwise each write a row and inflate the
        audit trail with events that were really one download.
        """
        from datetime import datetime, timedelta, timezone

        since = datetime.now(tz=timezone.utc) - timedelta(seconds=within_seconds)
        result = await self._session.execute(
            select(Download)
            .where(
                Download.user_id == user_id,
                Download.release_id == release_id,
                Download.downloaded_at >= since,
            )
            .order_by(Download.downloaded_at.desc())
            .limit(1)
        )
        return result.scalars().first()

    async def list_all(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        release_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Tuple[List[Download], int]:
        """
        Every download, newest first, for the administrative view.

        Optional filters narrow to a single release or account. There is no
        unfiltered variant that returns the address or user agent: those columns
        are recorded for abuse investigation and are deliberately not part of
        any response schema.
        """
        conditions = []
        if release_id is not None:
            conditions.append(Download.release_id == release_id)
        if user_id is not None:
            conditions.append(Download.user_id == user_id)

        count_stmt = select(func.count(Download.download_id))
        list_stmt = select(Download)
        for condition in conditions:
            count_stmt = count_stmt.where(condition)
            list_stmt = list_stmt.where(condition)

        total = (await self._session.execute(count_stmt)).scalar_one()
        result = await self._session.execute(
            list_stmt.order_by(Download.downloaded_at.desc()).offset(offset).limit(limit)
        )
        return result.scalars().all(), total

    async def count_all(self) -> int:
        """Total download events across every account."""
        result = await self._session.execute(select(func.count(Download.download_id)))
        return result.scalar_one()
