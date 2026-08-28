"""
app/schemas/feedback.py
────────────────────────
Pydantic v2 schemas for the Feedback entity.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.feedback import FeedbackStatus, FeedbackType


class CreateFeedbackRequest(BaseModel):
    """Schema for POST /api/v1/feedback"""
    type: FeedbackType
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=10000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)

    @model_validator(mode="after")
    def rating_only_for_rating_type(self) -> "CreateFeedbackRequest":
        if self.type == FeedbackType.RATING and self.rating is None:
            raise ValueError("rating is required when type is RATING.")
        if self.type != FeedbackType.RATING and self.rating is not None:
            raise ValueError("rating is only allowed when type is RATING.")
        return self


class FeedbackResponse(BaseModel):
    """Public response schema — does not include internal admin fields."""
    model_config = ConfigDict(from_attributes=True)

    feedback_id: uuid.UUID
    user_id: uuid.UUID
    type: FeedbackType
    title: str
    description: str
    rating: Optional[int]
    status: FeedbackStatus
    featured: bool
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]


class AdminUpdateFeedbackRequest(BaseModel):
    """Schema for PATCH /api/v1/admin/feedback/{id}"""
    status: Optional[FeedbackStatus] = None
    featured: Optional[bool] = None

    # Valid status transitions enforced in the service layer


class PublicTestimonialResponse(BaseModel):
    """
    An approved testimonial, as shown to anonymous visitors.

    Carries no identifier of any kind — not the user id, not the feedback id,
    and no name. Someone submitting feedback consented to it being read by the
    team, and an admin approving it consented to the *content* being shown. That
    is not the same as consenting to be named in public, and this schema cannot
    accidentally grant the second when only the first was given.

    Attribution would need an explicit opt-in captured at submission time.
    """
    model_config = ConfigDict(from_attributes=True)

    type: FeedbackType
    title: str
    description: str
    rating: Optional[int]
    created_at: datetime
