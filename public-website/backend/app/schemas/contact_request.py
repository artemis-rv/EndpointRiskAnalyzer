"""
app/schemas/contact_request.py
───────────────────────────────
Pydantic v2 schemas for the ContactRequest entity.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.contact_request import ContactCategory, ContactStatus


class CreateContactRequest(BaseModel):
    """Schema for POST /api/v1/contact"""
    subject: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1, max_length=10000)
    category: ContactCategory


class ContactRequestResponse(BaseModel):
    """Response schema for a contact request."""
    model_config = ConfigDict(from_attributes=True)

    contact_request_id: uuid.UUID
    user_id: uuid.UUID
    subject: str
    message: str
    category: ContactCategory
    status: ContactStatus
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime]
    handled_by_user_id: Optional[uuid.UUID]


class AdminUpdateContactRequest(BaseModel):
    """Schema for PATCH /api/v1/admin/contact/{id}"""
    status: Optional[ContactStatus] = None
    handled_by_user_id: Optional[uuid.UUID] = None

    # Status transitions are validated in the service layer
