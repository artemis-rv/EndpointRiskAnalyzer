"""
app/utils/pagination.py
────────────────────────
Pagination helper utilities.
"""

from __future__ import annotations

from typing import Generic, List, TypeVar

from app.schemas.common import PaginatedResponse

T = TypeVar("T")


def build_paginated_response(
    *,
    items: List[T],
    total: int,
    page: int,
    page_size: int,
) -> PaginatedResponse[T]:
    """Build a standardised paginated response object."""
    return PaginatedResponse(
        data=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
        has_prev=page > 1,
    )
