"""
app/repositories/user_repo.py
──────────────────────────────
Data access layer for the User entity.
All database queries are encapsulated here — no SQL in service/route layers.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        result = await self._session.execute(
            select(User).where(User.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self._session.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        result = await self._session.execute(
            select(User.user_id).where(User.email == email.lower())
        )
        return result.scalar_one_or_none() is not None

    async def create(
        self,
        *,
        first_name: str,
        last_name: str,
        email: str,
        password_hash: str,
        country_code: str,
        company_name: Optional[str] = None,
        role: UserRole = UserRole.USER,
    ) -> User:
        user = User(
            user_id=uuid.uuid4(),
            first_name=first_name,
            last_name=last_name,
            email=email.lower(),
            password_hash=password_hash,
            country_code=country_code.upper(),
            company_name=company_name,
            role=role,
            email_verified=False,
            is_active=True,
        )
        self._session.add(user)
        await self._session.flush()
        await self._session.refresh(user)
        return user

    async def update_fields(
        self, user_id: uuid.UUID, **fields: object
    ) -> Optional[User]:
        """Bulk-update specific fields on a user row."""
        await self._session.execute(
            update(User).where(User.user_id == user_id).values(**fields)
        )
        return await self.get_by_id(user_id)

    async def mark_email_verified(
        self, user_id: uuid.UUID
    ) -> Optional[User]:
        from datetime import datetime, timezone
        return await self.update_fields(
            user_id,
            email_verified=True,
            email_verified_at=datetime.now(tz=timezone.utc),
        )

    async def update_last_login(self, user_id: uuid.UUID) -> None:
        from datetime import datetime, timezone
        await self.update_fields(
            user_id, last_login_at=datetime.now(tz=timezone.utc)
        )

    async def update_password(
        self, user_id: uuid.UUID, password_hash: str
    ) -> None:
        await self.update_fields(user_id, password_hash=password_hash)

    async def list_all(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        role: Optional[UserRole] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[User], int]:
        """
        Registered accounts, newest first, for the admin view.

        The search term is bound as a parameter, never interpolated into SQL.
        It is also escaped for LIKE so that a user typing % or _ searches for
        those characters rather than turning the query into a wildcard scan.
        """
        conditions = []
        if role is not None:
            conditions.append(User.role == role)

        if search:
            # Escape the LIKE metacharacters. The backslash must be doubled
            # first, otherwise the escapes added afterwards get escaped in turn.
            escaped = (
                search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            pattern = f"%{escaped}%"
            conditions.append(
                or_(
                    User.first_name.ilike(pattern, escape="\\"),
                    User.last_name.ilike(pattern, escape="\\"),
                    User.email.ilike(pattern, escape="\\"),
                    User.company_name.ilike(pattern, escape="\\"),
                )
            )

        count_stmt = select(func.count(User.user_id))
        list_stmt = select(User)
        for condition in conditions:
            count_stmt = count_stmt.where(condition)
            list_stmt = list_stmt.where(condition)

        total = (await self._session.execute(count_stmt)).scalar_one()
        result = await self._session.execute(
            list_stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        )
        return result.scalars().all(), total
