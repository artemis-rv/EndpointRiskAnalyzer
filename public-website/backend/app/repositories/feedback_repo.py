"""
app/repositories/feedback_repo.py
───────────────────────────────────
Data access layer for the Feedback entity.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feedback import Feedback, FeedbackStatus, FeedbackType


class FeedbackRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, feedback_id: uuid.UUID) -> Optional[Feedback]:
        result = await self._session.execute(
            select(Feedback).where(Feedback.feedback_id == feedback_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        type: FeedbackType,
        title: str,
        description: str,
        rating: Optional[int] = None,
    ) -> Feedback:
        fb = Feedback(
            feedback_id=uuid.uuid4(),
            user_id=user_id,
            type=type,
            title=title,
            description=description,
            rating=rating,
            status=FeedbackStatus.NEW,
            featured=False,
        )
        self._session.add(fb)
        await self._session.flush()
        await self._session.refresh(fb)
        return fb

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Feedback], int]:
        base = select(Feedback).where(Feedback.user_id == user_id)

        count_result = await self._session.execute(
            select(func.count(Feedback.feedback_id)).where(
                Feedback.user_id == user_id
            )
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            base.order_by(Feedback.created_at.desc()).offset(offset).limit(limit)
        )
        return result.scalars().all(), total

    async def list_all(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        status: Optional[FeedbackStatus] = None,
    ) -> Tuple[List[Feedback], int]:
        conditions = []
        if status:
            conditions.append(Feedback.status == status)

        count_query = select(func.count(Feedback.feedback_id))
        list_query = select(Feedback)
        if conditions:
            count_query = count_query.where(*conditions)
            list_query = list_query.where(*conditions)

        count_result = await self._session.execute(count_query)
        total = count_result.scalar_one()

        result = await self._session.execute(
            list_query.order_by(Feedback.created_at.desc()).offset(offset).limit(limit)
        )
        return result.scalars().all(), total

    async def update_fields(
        self, feedback_id: uuid.UUID, **fields: object
    ) -> Optional[Feedback]:
        await self._session.execute(
            update(Feedback)
            .where(Feedback.feedback_id == feedback_id)
            .values(**fields)
        )
        return await self.get_by_id(feedback_id)

    async def list_public_testimonials(self, *, limit: int = 12) -> List[Feedback]:
        """
        Feedback cleared for public display.

        The filter lives here, in SQL, and nowhere else. Fetching all feedback
        and filtering client-side would put every unreviewed bug report and
        complaint on the wire to an anonymous visitor; whatever the UI then did
        with it, the disclosure would already have happened.

        Three conditions must all hold:
          featured  — an admin explicitly approved it for display
          ACCEPTED  — it completed review rather than merely being submitted
          type      — TESTIMONIAL or RATING, the two kinds meant to be shown
        """
        result = await self._session.execute(
            select(Feedback)
            .where(
                Feedback.featured.is_(True),
                Feedback.status == FeedbackStatus.ACCEPTED,
                Feedback.type.in_([FeedbackType.TESTIMONIAL, FeedbackType.RATING]),
            )
            .order_by(Feedback.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
