"""
app/api/v1/feedback.py
───────────────────────
Feedback API routes (user-facing).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.feedback import (
    CreateFeedbackRequest,
    FeedbackResponse,
    PublicTestimonialResponse,
)
from app.services.feedback_service import FeedbackService

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post(
    "",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit feedback",
)
async def create_feedback(
    body: CreateFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackResponse:
    service = FeedbackService(db)
    return await service.create(body, user_id=current_user.user_id)


@router.get(
    "/me",
    response_model=PaginatedResponse[FeedbackResponse],
    status_code=status.HTTP_200_OK,
    summary="List my feedback submissions",
)
async def list_my_feedback(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[FeedbackResponse]:
    service = FeedbackService(db)
    return await service.list_mine(
        current_user.user_id, page=page, page_size=page_size
    )


@router.get(
    "/testimonials",
    response_model=list[PublicTestimonialResponse],
    status_code=status.HTTP_200_OK,
    summary="Approved testimonials for public display",
    description=(
        "Public. Returns only feedback an admin has both accepted and featured. "
        "Filtering happens in the query, not in the client."
    ),
)
async def list_public_testimonials(
    limit: int = Query(default=12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[PublicTestimonialResponse]:
    service = FeedbackService(db)
    return await service.list_public_testimonials(limit=limit)
