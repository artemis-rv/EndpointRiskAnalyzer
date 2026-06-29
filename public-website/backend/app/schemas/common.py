"""
app/schemas/common.py
──────────────────────
Shared Pydantic v2 schemas and response envelope types.
"""

from __future__ import annotations

from typing import Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

DataT = TypeVar("DataT")


class APIResponse(BaseModel, Generic[DataT]):
    """Standard API response envelope."""
    success: bool = True
    data: Optional[DataT] = None
    message: Optional[str] = None


class PaginatedResponse(BaseModel, Generic[DataT]):
    """Paginated list response."""
    success: bool = True
    data: List[DataT]
    total: int
    page: int
    page_size: int
    has_next: bool
    has_prev: bool


class ErrorDetail(BaseModel):
    """Single error detail."""
    field: Optional[str] = None
    message: str
    code: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = False
    error: str
    details: Optional[List[ErrorDetail]] = None
    request_id: Optional[str] = None


class PaginationParams(BaseModel):
    """Common pagination query parameters."""
    page: int = Field(default=1, ge=1, le=1000)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
