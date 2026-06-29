"""
app/schemas/release.py
───────────────────────
Pydantic v2 schemas for the Release entity.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.release import ReleaseStatus

_SHA256_RE = re.compile(r"^[a-fA-F0-9]{64}$")


class ReleasePublicResponse(BaseModel):
    """Public view of a release — omits file_path for security."""
    model_config = ConfigDict(from_attributes=True)

    release_id: uuid.UUID
    version: str
    title: str
    description: Optional[str]
    release_notes: str
    file_size: int
    sha256_checksum: str
    published_at: Optional[datetime]
    is_latest: bool
    release_status: ReleaseStatus
    created_at: datetime
    updated_at: datetime


class ReleaseAdminResponse(ReleasePublicResponse):
    """Admin view — includes file_path and publisher info."""
    file_path: str
    published_by_user_id: uuid.UUID


class CreateReleaseRequest(BaseModel):
    """Schema for POST /api/v1/admin/releases"""
    version: str = Field(min_length=1, max_length=50, pattern=r"^\d+\.\d+\.\d+.*$")
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2048)
    release_notes: str = Field(min_length=1, max_length=65536)
    file_path: str = Field(min_length=1, max_length=1024)
    file_size: int = Field(ge=1)
    sha256_checksum: str = Field(min_length=64, max_length=64)
    release_status: ReleaseStatus = ReleaseStatus.DRAFT
    published_at: Optional[datetime] = None

    @field_validator("sha256_checksum")
    @classmethod
    def validate_sha256(cls, v: str) -> str:
        if not _SHA256_RE.match(v):
            raise ValueError("sha256_checksum must be a 64-character hex string.")
        return v.lower()


class UpdateReleaseRequest(BaseModel):
    """Schema for PATCH /api/v1/admin/releases/{id}"""
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2048)
    release_notes: Optional[str] = Field(default=None, min_length=1, max_length=65536)
    file_path: Optional[str] = Field(default=None, min_length=1, max_length=1024)
    file_size: Optional[int] = Field(default=None, ge=1)
    sha256_checksum: Optional[str] = Field(default=None, min_length=64, max_length=64)
    release_status: Optional[ReleaseStatus] = None
    is_latest: Optional[bool] = None
    published_at: Optional[datetime] = None

    @field_validator("sha256_checksum")
    @classmethod
    def validate_sha256(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _SHA256_RE.match(v):
            raise ValueError("sha256_checksum must be a 64-character hex string.")
        return v.lower() if v else v
