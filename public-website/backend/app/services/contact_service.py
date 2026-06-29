"""
app/services/contact_service.py
────────────────────────────────
Business logic for the ContactRequest entity.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact_request import ContactStatus
from app.repositories.contact_repo import ContactRepository
from app.schemas.common import PaginatedResponse
from app.schemas.contact_request import (
    AdminUpdateContactRequest,
    ContactRequestResponse,
    CreateContactRequest,
)
from app.utils.audit import log_admin_action
from app.utils.pagination import build_paginated_response

# Valid status transitions
_VALID_TRANSITIONS: dict[ContactStatus, set[ContactStatus]] = {
    ContactStatus.NEW: {ContactStatus.IN_PROGRESS},
    ContactStatus.IN_PROGRESS: {ContactStatus.RESPONDED, ContactStatus.CLOSED},
    ContactStatus.RESPONDED: {ContactStatus.IN_PROGRESS, ContactStatus.CLOSED},
    ContactStatus.CLOSED: set(),
}


class ContactService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._contact_repo = ContactRepository(session)

    async def create(
        self, request: CreateContactRequest, *, user_id: uuid.UUID
    ) -> ContactRequestResponse:
        cr = await self._contact_repo.create(
            user_id=user_id,
            subject=request.subject,
            message=request.message,
            category=request.category,
        )
        await self._session.commit()
        return ContactRequestResponse.model_validate(cr)

    async def list_mine(
        self, user_id: uuid.UUID, *, page: int, page_size: int
    ) -> PaginatedResponse[ContactRequestResponse]:
        items_raw, total = await self._contact_repo.list_by_user(
            user_id, offset=(page - 1) * page_size, limit=page_size
        )
        items = [ContactRequestResponse.model_validate(c) for c in items_raw]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )

    async def list_all_admin(
        self,
        *,
        page: int,
        page_size: int,
        status: Optional[ContactStatus] = None,
    ) -> PaginatedResponse[ContactRequestResponse]:
        items_raw, total = await self._contact_repo.list_all(
            offset=(page - 1) * page_size, limit=page_size, status=status
        )
        items = [ContactRequestResponse.model_validate(c) for c in items_raw]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )

    async def admin_update(
        self,
        contact_request_id: uuid.UUID,
        request: AdminUpdateContactRequest,
        *,
        actor_id: uuid.UUID,
        request_id: Optional[str] = None,
    ) -> ContactRequestResponse:
        from fastapi import HTTPException

        cr = await self._contact_repo.get_by_id(contact_request_id)
        if not cr:
            raise HTTPException(status_code=404, detail="Contact request not found.")

        updates: dict = {}

        if request.status is not None:
            allowed = _VALID_TRANSITIONS.get(cr.status, set())
            if request.status not in allowed and request.status != cr.status:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Cannot transition contact from {cr.status} to {request.status}."
                    ),
                )
            updates["status"] = request.status
            if request.status == ContactStatus.CLOSED:
                updates["closed_at"] = datetime.now(tz=timezone.utc)

        if request.handled_by_user_id is not None:
            updates["handled_by_user_id"] = request.handled_by_user_id

        if not updates:
            return ContactRequestResponse.model_validate(cr)

        updated = await self._contact_repo.update_fields(
            contact_request_id, **updates
        )
        await self._session.commit()

        log_admin_action(
            event="update_contact",
            actor_id=str(actor_id),
            target_type="ContactRequest",
            target_id=str(contact_request_id),
            outcome="success",
            changes={k: str(v) for k, v in updates.items()},
            request_id=request_id,
        )

        return ContactRequestResponse.model_validate(updated)
