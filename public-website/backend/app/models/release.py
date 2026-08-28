"""
app/models/release.py
──────────────────────
SQLAlchemy ORM model for the Release entity.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.download import Download


class ReleaseStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Release(Base):
    __tablename__ = "Release"

    release_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    version: Mapped[str] = mapped_column(
        String, unique=True, nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    release_notes: Mapped[str] = mapped_column(Text, nullable=False)

    file_path: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)

    sha256_checksum: Mapped[str] = mapped_column(String(64), nullable=False)

    published_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("User.user_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
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

    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_latest: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    release_status: Mapped[ReleaseStatus] = mapped_column(
        Enum(ReleaseStatus, name="ReleaseStatus", create_type=False),
        nullable=False,
        default=ReleaseStatus.DRAFT,
        server_default="DRAFT",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    published_by: Mapped["User"] = relationship(
        "User", back_populates="published_releases", lazy="noload"
    )
    downloads: Mapped[List["Download"]] = relationship(
        "Download", back_populates="release", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Release id={self.release_id} version={self.version!r}>"
