"""
app/services/download_service.py
──────────────────────────────────
Business logic for download tracking.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.release import ReleaseStatus
from app.repositories.download_repo import DownloadRepository
from app.repositories.release_repo import ReleaseRepository
from app.repositories.user_repo import UserRepository
from app.schemas.common import PaginatedResponse
from app.schemas.download import CreateDownloadRequest, DownloadResponse
from app.core.logging import get_logger
from app.services.storage import (
    ArtefactNotFound,
    ArtefactRejected,
    artefact_size,
    resolve_artefact,
)
from app.utils.audit import log_download_event
from app.utils.pagination import build_paginated_response

logger = get_logger(__name__)


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

    async def prepare_delivery(
        self,
        release_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        download_source: str = "website",
    ) -> tuple[Path, str, str]:
        """
        Authorise, record and locate a release artefact for delivery.

        Returns (resolved_path, download_filename, media_type).

        WHEN THE RECORD IS WRITTEN
        The record is created once every check has passed *and* the artefact has
        been confirmed present and readable — immediately before the response
        starts streaming.

        The alternative, recording only after a completed transfer, cannot be
        implemented honestly over HTTP: the server does not learn whether the
        client kept the bytes, and a client that aborts at 99% is
        indistinguishable from one that finished. Recording at authorisation
        time instead would count refusals and missing files as downloads.

        Recording at the moment delivery begins means the log answers "who was
        given this build, and when", which is the question an audit trail for
        security software actually needs to answer. A transfer that fails
        mid-flight is a delivery that started, and it stays in the log.

        Retries inside a short window reuse the existing row rather than adding
        one, so a reconnect does not read as a second download.
        """
        from fastapi import HTTPException

        # ── Authentication is already established by the dependency; these are
        #    the authorisation checks, re-done here rather than assumed. ──────
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is inactive.")
        if not user.email_verified:
            raise HTTPException(
                status_code=403,
                detail="Email verification required before downloading.",
            )

        release = await self._release_repo.get_by_id(release_id)
        if not release or release.release_status != ReleaseStatus.PUBLISHED:
            # A draft or archived release is reported as absent rather than
            # forbidden: whether an unpublished release exists is not something
            # a non-admin caller should be able to probe.
            raise HTTPException(status_code=404, detail="Release not found.")

        recent_count = await self._download_repo.count_recent_for_user(
            user_id, release_id, within_minutes=60
        )
        if recent_count >= 5:
            raise HTTPException(
                status_code=429,
                detail="Too many download requests. Please try again later.",
            )

        # ── Locate the artefact before recording anything ────────────────────
        try:
            resolved, filename = resolve_artefact(
                release.file_path, version=release.version
            )
        except ArtefactRejected:
            # The stored path escapes the storage root. This is a
            # misconfiguration or an attack, never a normal condition, and the
            # caller learns nothing about why.
            log_download_event(
                actor_id=str(user_id),
                release_id=str(release.release_id),
                release_version=release.version,
                ip_address=ip_address,
                outcome="rejected_path",
                request_id=request_id,
            )
            raise HTTPException(
                status_code=500, detail="This release cannot be delivered."
            )
        except ArtefactNotFound:
            log_download_event(
                actor_id=str(user_id),
                release_id=str(release.release_id),
                release_version=release.version,
                ip_address=ip_address,
                outcome="missing_artefact",
                request_id=request_id,
            )
            raise HTTPException(
                status_code=404,
                detail="This release is not currently available for download.",
            )

        # Cheap mapping check: the artefact on disk should be the one the
        # release describes. A mismatch means the row and the file have drifted
        # apart, and serving it would hand someone a build whose published
        # checksum does not match what they received.
        actual_size = artefact_size(resolved)
        if actual_size is not None and actual_size != release.file_size:
            logger.error(
                "artefact_size_mismatch",
                release_id=str(release.release_id),
                version=release.version,
                expected=release.file_size,
                actual=actual_size,
                request_id=request_id,
            )
            raise HTTPException(
                status_code=500, detail="This release cannot be delivered."
            )

        # ── Record, collapsing rapid retries ─────────────────────────────────
        existing = await self._download_repo.find_recent_for_user(
            user_id, release_id, within_seconds=120
        )
        if existing is None:
            await self._download_repo.create(
                user_id=user_id,
                release_id=release_id,
                download_source=download_source,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            await self._session.commit()
            outcome = "success"
        else:
            outcome = "success_deduplicated"

        log_download_event(
            actor_id=str(user_id),
            release_id=str(release.release_id),
            release_version=release.version,
            ip_address=ip_address,
            outcome=outcome,
            request_id=request_id,
        )

        return resolved, filename, "application/octet-stream"

    async def list_all_admin(
        self,
        *,
        page: int,
        page_size: int,
        release_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> PaginatedResponse[DownloadResponse]:
        """
        Download activity across every account, for the admin view.

        Uses `DownloadResponse`, so the address and user agent recorded on each
        row are not returned here any more than they are to the account itself.
        """
        downloads, total = await self._download_repo.list_all(
            offset=(page - 1) * page_size,
            limit=page_size,
            release_id=release_id,
            user_id=user_id,
        )
        items = [DownloadResponse.model_validate(d) for d in downloads]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )
