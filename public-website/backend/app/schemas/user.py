"""
app/schemas/user.py
────────────────────
Pydantic v2 schemas for the User entity.

Security notes:
- password_hash is NEVER included in any response schema
- email_verified_at, last_login_at are read-only (never user-settable via API)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserPublicResponse(BaseModel):
    """Safe public representation of a user. Never includes sensitive fields."""
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    first_name: str
    last_name: str
    email: EmailStr
    country_code: str
    company_name: Optional[str]
    role: UserRole
    email_verified: bool
    email_verified_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime]
    is_active: bool


class UpdateMeRequest(BaseModel):
    """Schema for PATCH /api/v1/users/me — only mutable fields."""
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=10)
    company_name: Optional[str] = Field(default=None, max_length=255)
