"""
app/api/v1/contact.py
──────────────────────
Contact request API routes (user-facing).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.contact_request import ContactRequestResponse, CreateContactRequest
from app.services.contact_service import ContactService

router = APIRouter(prefix="/contact", tags=["Contact"])


@router.post(
    "",
    response_model=ContactRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a contact request",
)
async def create_contact(
    body: CreateContactRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ContactRequestResponse:
    service = ContactService(db)
    return await service.create(body, user_id=current_user.user_id)


@router.get(
    "/me",
    response_model=PaginatedResponse[ContactRequestResponse],
    status_code=status.HTTP_200_OK,
    summary="List my contact requests",
)
async def list_my_contacts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[ContactRequestResponse]:
    service = ContactService(db)
    return await service.list_mine(
        current_user.user_id, page=page, page_size=page_size
    )
