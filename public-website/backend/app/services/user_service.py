"""
app/services/user_service.py
─────────────────────────────
Business logic for user profile operations.
"""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.repositories.user_repo import UserRepository
from app.schemas.common import PaginatedResponse
from app.utils.pagination import build_paginated_response
from app.schemas.user import UpdateMeRequest, UserPublicResponse


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._user_repo = UserRepository(session)

    async def get_me(self, user_id: uuid.UUID) -> UserPublicResponse:
        from fastapi import HTTPException

        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return UserPublicResponse.model_validate(user)

    async def update_me(
        self, user_id: uuid.UUID, request: UpdateMeRequest
    ) -> UserPublicResponse:
        from fastapi import HTTPException

        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        updates = request.model_dump(exclude_none=True)
        if not updates:
            return UserPublicResponse.model_validate(user)

        # Normalise values
        if "country_code" in updates:
            updates["country_code"] = updates["country_code"].upper()
        if "first_name" in updates:
            updates["first_name"] = updates["first_name"].strip()
        if "last_name" in updates:
            updates["last_name"] = updates["last_name"].strip()

        updated_user = await self._user_repo.update_fields(user_id, **updates)
        await self._session.commit()

        return UserPublicResponse.model_validate(updated_user)

    async def list_all_admin(
        self,
        *,
        page: int,
        page_size: int,
        role: Optional[UserRole] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[UserPublicResponse]:
        """
        Registered accounts for the admin view.

        Mapped through `UserPublicResponse`, which is the same shape the account
        endpoint returns. Nothing sensitive is added for admins: the password
        hash is not in that schema, and no code path here reads it.
        """
        users, total = await self._user_repo.list_all(
            offset=(page - 1) * page_size,
            limit=page_size,
            role=role,
            search=search,
        )
        items = [UserPublicResponse.model_validate(user) for user in users]
        return build_paginated_response(
            items=items, total=total, page=page, page_size=page_size
        )
