"""
app/services/feedback_service.py
──────────────────────────────────
Business logic for the Feedback entity.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feedback import FeedbackStatus, FeedbackType
from app.repositories.feedback_repo import FeedbackRepository
from app.schemas.common import PaginatedResponse
from app.schemas.feedback import (
    AdminUpdateFeedbackRequest,
    CreateFeedbackRequest,
    FeedbackResponse,
)
from app.utils.audit import log_admin_action
from app.utils.pagination import build_paginated_response

# Valid status transitions
_VALID_TRANSITIONS: dict[FeedbackStatus, set[FeedbackStatus]] = {
    FeedbackStatus.NEW: {FeedbackStatus.UNDER_REVIEW, FeedbackStatus.REJECTED},
    FeedbackStatus.UNDER_REVIEW: {
        FeedbackStatus.ACCEPTED,
        FeedbackStatus.REJECTED,
        FeedbackStatus.RESOLVED,
    },
    FeedbackStatus.ACCEPTED: {FeedbackStatus.RESOLVED},
    FeedbackStatus.REJECTED: set(),
    FeedbackStatus.RESOLVED: set(),
}


class FeedbackService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._feedback_repo = FeedbackRepository(session)

    async def create(
        self, request: CreateFeedbackRequest, *, user_id: uuid.UUID
    ) -> FeedbackResponse:
        fb = await self._feedback_repo.create(
            user_id=user_id,
            type=request.type,
            title=request.title,
            description=request.description,
            rating=request.rating,
        )
        await self._session.commit()
        return FeedbackResponse.model_validate(fb)

    async def list_mine(
        self, user_id: uuid.UUID, *, page: int, page_size: int
    ) -> PaginatedResponse[FeedbackResponse]:
        items_raw, total = await self._feedback_repo.list_by_user(
            user_id, offset=(page - 1) * page_size, limit=page_size
        )
        items = [FeedbackResponse.model_validate(f) for f in items_raw]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )

    async def list_all_admin(
        self,
        *,
        page: int,
        page_size: int,
        status: Optional[FeedbackStatus] = None,
    ) -> PaginatedResponse[FeedbackResponse]:
        items_raw, total = await self._feedback_repo.list_all(
            offset=(page - 1) * page_size, limit=page_size, status=status
        )
        items = [FeedbackResponse.model_validate(f) for f in items_raw]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )

    async def admin_update(
        self,
        feedback_id: uuid.UUID,
        request: AdminUpdateFeedbackRequest,
        *,
        actor_id: uuid.UUID,
        request_id: Optional[str] = None,
    ) -> FeedbackResponse:
        from fastapi import HTTPException

        fb = await self._feedback_repo.get_by_id(feedback_id)
        if not fb:
            raise HTTPException(status_code=404, detail="Feedback not found.")

        updates: dict = {}

        if request.status is not None:
            allowed = _VALID_TRANSITIONS.get(fb.status, set())
            if request.status not in allowed and request.status != fb.status:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Cannot transition feedback from {fb.status} to {request.status}."
                    ),
                )
            updates["status"] = request.status
            if request.status == FeedbackStatus.RESOLVED:
                updates["resolved_at"] = datetime.now(tz=timezone.utc)

        if request.featured is not None:
            updates["featured"] = request.featured

        if not updates:
            return FeedbackResponse.model_validate(fb)

        updated = await self._feedback_repo.update_fields(feedback_id, **updates)
        await self._session.commit()

        log_admin_action(
            event="update_feedback",
            actor_id=str(actor_id),
            target_type="Feedback",
            target_id=str(feedback_id),
            outcome="success",
            changes=updates,
            request_id=request_id,
        )

        return FeedbackResponse.model_validate(updated)
