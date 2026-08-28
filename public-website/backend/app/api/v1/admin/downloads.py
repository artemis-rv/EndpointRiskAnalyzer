"""
app/api/v1/admin/downloads.py
──────────────────────────────
Admin-only download activity.

PRIVACY NOTE
The `Download` row stores `ip_address` and `user_agent`, but this endpoint
returns neither. They are collected for abuse investigation, which is a
different purpose from operational reporting, and an admin browsing activity has
no need of them. `DownloadResponse` — the same schema an account sees for its
own history — is reused so there is one definition of what a download looks like
over the wire, and widening the audience does not widen the disclosure.

Aggregate figures are derived here rather than stored. There is no
`download_count` column on `Release`, and adding one would introduce a value
that can disagree with the rows it summarises.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.download import DownloadResponse
from app.services.download_service import DownloadService

router = APIRouter(prefix="/admin/downloads", tags=["Admin — Downloads"])


@router.get(
    "",
    response_model=PaginatedResponse[DownloadResponse],
    status_code=status.HTTP_200_OK,
    summary="[Admin] List download activity across all accounts",
)
async def admin_list_downloads(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    release_id: Optional[uuid.UUID] = Query(
        default=None, description="Filter to a single release"
    ),
    user_id: Optional[uuid.UUID] = Query(
        default=None, description="Filter to a single account"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> PaginatedResponse[DownloadResponse]:
    service = DownloadService(db)
    return await service.list_all_admin(
        page=page, page_size=page_size, release_id=release_id, user_id=user_id
    )
