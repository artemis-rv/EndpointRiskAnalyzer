"""
app/api/v1/admin/contact.py
─────────────────────────────
Admin-only contact request management API routes.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.contact_request import ContactStatus
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.contact_request import AdminUpdateContactRequest, ContactRequestResponse
from app.services.contact_service import ContactService

router = APIRouter(prefix="/admin/contact", tags=["Admin — Contact"])


@router.get(
    "",
    response_model=PaginatedResponse[ContactRequestResponse],
    status_code=status.HTTP_200_OK,
    summary="[Admin] List all contact requests",
)
async def admin_list_contacts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[ContactStatus] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> PaginatedResponse[ContactRequestResponse]:
    service = ContactService(db)
    return await service.list_all_admin(
        page=page, page_size=page_size, status=status_filter
    )


@router.patch(
    "/{contact_request_id}",
    response_model=ContactRequestResponse,
    status_code=status.HTTP_200_OK,
    summary="[Admin] Update contact request status or assignee",
)
async def admin_update_contact(
    request: Request,
    contact_request_id: uuid.UUID,
    body: AdminUpdateContactRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> ContactRequestResponse:
    service = ContactService(db)
    return await service.admin_update(
        contact_request_id,
        body,
        actor_id=current_user.user_id,
        request_id=getattr(request.state, "request_id", None),
    )
