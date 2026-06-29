"""
app/api/v1/admin/feedback.py
──────────────────────────────
Admin-only feedback management API routes.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.feedback import FeedbackStatus
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.feedback import AdminUpdateFeedbackRequest, FeedbackResponse
from app.services.feedback_service import FeedbackService

router = APIRouter(prefix="/admin/feedback", tags=["Admin — Feedback"])


@router.get(
    "",
    response_model=PaginatedResponse[FeedbackResponse],
    status_code=status.HTTP_200_OK,
    summary="[Admin] List all feedback",
)
async def admin_list_feedback(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[FeedbackStatus] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> PaginatedResponse[FeedbackResponse]:
    service = FeedbackService(db)
    return await service.list_all_admin(
        page=page, page_size=page_size, status=status_filter
    )


@router.patch(
    "/{feedback_id}",
    response_model=FeedbackResponse,
    status_code=status.HTTP_200_OK,
    summary="[Admin] Update feedback status or featured flag",
)
async def admin_update_feedback(
    request: Request,
    feedback_id: uuid.UUID,
    body: AdminUpdateFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> FeedbackResponse:
    service = FeedbackService(db)
    return await service.admin_update(
        feedback_id,
        body,
        actor_id=current_user.user_id,
        request_id=getattr(request.state, "request_id", None),
    )
