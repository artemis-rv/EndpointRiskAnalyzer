"""
app/models/contact_request.py
──────────────────────────────
SQLAlchemy ORM model for the ContactRequest entity.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class ContactCategory(str, enum.Enum):
    SALES = "SALES"
    SUPPORT = "SUPPORT"
    BUG = "BUG"
    FEATURE_REQUEST = "FEATURE_REQUEST"
    PARTNERSHIP = "PARTNERSHIP"
    GENERAL = "GENERAL"


class ContactStatus(str, enum.Enum):
    NEW = "NEW"
    IN_PROGRESS = "IN_PROGRESS"
    RESPONDED = "RESPONDED"
    CLOSED = "CLOSED"


class ContactRequest(Base):
    __tablename__ = "ContactRequest"

    contact_request_id: Mapped[uuid.UUID] = mapped_column(
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

    subject: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    category: Mapped[ContactCategory] = mapped_column(
        Enum(ContactCategory, name="ContactCategory", create_type=False),
        nullable=False,
    )

    status: Mapped[ContactStatus] = mapped_column(
        Enum(ContactStatus, name="ContactStatus", create_type=False),
        nullable=False,
        default=ContactStatus.NEW,
        server_default="NEW",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        # Prisma owns this schema, and Prisma implements `@updatedAt` in its
        # client rather than as a database default — so the column is NOT NULL
        # with nothing to fall back on. A `server_default` here described a
        # default the database does not have, and every INSERT that omitted the
        # value failed with a not-null violation.
        #
        # `default=` is client-side: SQLAlchemy emits now() as part of the
        # INSERT, which is the same contract Prisma's client provides.
        default=func.now(),
        onupdate=func.now(),
    )

    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    handled_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("User.user_id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(
        "User",
        back_populates="contact_requests",
        foreign_keys=[user_id],
        lazy="noload",
    )
    handled_by: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="handled_requests",
        foreign_keys=[handled_by_user_id],
        lazy="noload",
    )

    # ── Indexes (match Prisma schema) ─────────────────────────────────────────
    __table_args__ = (
        Index("ix_contact_request_user_id", "user_id"),
        Index("ix_contact_request_status", "status"),
        Index("ix_contact_request_handled_by", "handled_by_user_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<ContactRequest id={self.contact_request_id} "
            f"category={self.category} status={self.status}>"
        )
