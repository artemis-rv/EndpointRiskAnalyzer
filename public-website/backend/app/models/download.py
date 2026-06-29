"""
app/models/download.py
───────────────────────
SQLAlchemy ORM model for the Download entity.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.release import Release


class Download(Base):
    __tablename__ = "Download"

    download_id: Mapped[uuid.UUID] = mapped_column(
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
    release_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("Release.release_id", ondelete="RESTRICT"),
        nullable=False,
    )

    downloaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    download_source: Mapped[str] = mapped_column(String(64), nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(
        "User", back_populates="downloads", lazy="noload"
    )
    release: Mapped["Release"] = relationship(
        "Release", back_populates="downloads", lazy="noload"
    )

    # ── Indexes (match Prisma schema) ─────────────────────────────────────────
    __table_args__ = (
        Index("ix_download_user_id", "user_id"),
        Index("ix_download_release_id", "release_id"),
        Index("ix_download_downloaded_at", "downloaded_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<Download id={self.download_id} "
            f"user={self.user_id} release={self.release_id}>"
        )
