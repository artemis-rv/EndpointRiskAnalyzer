"""
app/schemas/download.py
────────────────────────
Pydantic v2 schemas for the Download entity.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CreateDownloadRequest(BaseModel):
    """Schema for POST /api/v1/downloads"""
    release_id: uuid.UUID
    download_source: str = Field(default="website", min_length=1, max_length=64)


class DownloadResponse(BaseModel):
    """Response schema for a download record."""
    model_config = ConfigDict(from_attributes=True)

    download_id: uuid.UUID
    user_id: uuid.UUID
    release_id: uuid.UUID
    downloaded_at: datetime
    download_source: str
    # ip_address and user_agent are NOT returned — privacy by default
