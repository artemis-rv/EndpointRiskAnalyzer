"""
app/repositories/contact_repo.py
──────────────────────────────────
Data access layer for the ContactRequest entity.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact_request import ContactCategory, ContactRequest, ContactStatus


class ContactRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(
        self, contact_request_id: uuid.UUID
    ) -> Optional[ContactRequest]:
        result = await self._session.execute(
            select(ContactRequest).where(
                ContactRequest.contact_request_id == contact_request_id
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        subject: str,
        message: str,
        category: ContactCategory,
    ) -> ContactRequest:
        cr = ContactRequest(
            contact_request_id=uuid.uuid4(),
            user_id=user_id,
            subject=subject,
            message=message,
            category=category,
            status=ContactStatus.NEW,
        )
        self._session.add(cr)
        await self._session.flush()
        await self._session.refresh(cr)
        return cr

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[ContactRequest], int]:
        count_result = await self._session.execute(
            select(func.count(ContactRequest.contact_request_id)).where(
                ContactRequest.user_id == user_id
            )
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(ContactRequest)
            .where(ContactRequest.user_id == user_id)
            .order_by(ContactRequest.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def list_all(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        status: Optional[ContactStatus] = None,
    ) -> Tuple[List[ContactRequest], int]:
        conditions = []
        if status:
            conditions.append(ContactRequest.status == status)

        count_query = select(func.count(ContactRequest.contact_request_id))
        list_query = select(ContactRequest)
        if conditions:
            count_query = count_query.where(*conditions)
            list_query = list_query.where(*conditions)

        count_result = await self._session.execute(count_query)
        total = count_result.scalar_one()

        result = await self._session.execute(
            list_query.order_by(ContactRequest.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def update_fields(
        self, contact_request_id: uuid.UUID, **fields: object
    ) -> Optional[ContactRequest]:
        await self._session.execute(
            update(ContactRequest)
            .where(ContactRequest.contact_request_id == contact_request_id)
            .values(**fields)
        )
        return await self.get_by_id(contact_request_id)
