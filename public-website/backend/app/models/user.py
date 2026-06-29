"""
app/models/user.py
───────────────────
SQLAlchemy ORM model for the User entity.
Mirrors the Prisma schema exactly — same column names, types, and constraints.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.download import Download
    from app.models.feedback import Feedback
    from app.models.contact_request import ContactRequest
    from app.models.release import Release


class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class User(Base):
    __tablename__ = "User"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)

    email: Mapped[str] = mapped_column(
        String, unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String, nullable=False)

    country_code: Mapped[str] = mapped_column(String(10), nullable=False)
    company_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole", create_type=True),
        nullable=False,
        default=UserRole.USER,
        server_default="USER",
    )

    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
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

    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    published_releases: Mapped[List["Release"]] = relationship(
        "Release", back_populates="published_by", lazy="noload"
    )
    downloads: Mapped[List["Download"]] = relationship(
        "Download", back_populates="user", lazy="noload"
    )
    feedbacks: Mapped[List["Feedback"]] = relationship(
        "Feedback", back_populates="user", lazy="noload"
    )
    contact_requests: Mapped[List["ContactRequest"]] = relationship(
        "ContactRequest",
        back_populates="user",
        foreign_keys="ContactRequest.user_id",
        lazy="noload",
    )
    handled_requests: Mapped[List["ContactRequest"]] = relationship(
        "ContactRequest",
        back_populates="handled_by",
        foreign_keys="ContactRequest.handled_by_user_id",
        lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<User id={self.user_id} email={self.email!r}>"
