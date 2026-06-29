"""
app/models/feedback.py
───────────────────────
SQLAlchemy ORM model for the Feedback entity.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class FeedbackType(str, enum.Enum):
    RATING = "RATING"
    BUG = "BUG"
    FEATURE_REQUEST = "FEATURE_REQUEST"
    TESTIMONIAL = "TESTIMONIAL"
    GENERAL = "GENERAL"


class FeedbackStatus(str, enum.Enum):
    NEW = "NEW"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    RESOLVED = "RESOLVED"


class Feedback(Base):
    __tablename__ = "Feedback"

    feedback_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("User.user_id", ondelete="RESTRICT"),
        nullable=False,
    )

    type: Mapped[FeedbackType] = mapped_column(
        Enum(FeedbackType, name="feedbacktype", create_type=True),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(FeedbackStatus, name="feedbackstatus", create_type=True),
        nullable=False,
        default=FeedbackStatus.NEW,
        server_default="NEW",
    )

    featured: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(
        "User", back_populates="feedbacks", lazy="noload"
    )

    # ── Indexes (match Prisma schema) ─────────────────────────────────────────
    __table_args__ = (
        Index("ix_feedback_user_id", "user_id"),
        Index("ix_feedback_status", "status"),
        Index("ix_feedback_featured", "featured"),
    )

    def __repr__(self) -> str:
        return f"<Feedback id={self.feedback_id} type={self.type}>"
