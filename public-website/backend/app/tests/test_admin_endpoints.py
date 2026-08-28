"""
app/tests/test_admin_endpoints.py
──────────────────────────────────
The two admin endpoints added in Phase 6.12, plus the public testimonials feed.

The authorisation tests matter most: the frontend hides admin routes from
non-admins, but that is presentation. These assert that the server refuses,
which is the part that actually protects the data.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.feedback import Feedback, FeedbackStatus, FeedbackType


def _auth(user) -> dict[str, str]:
    token = create_access_token(subject=str(user.user_id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


async def _make_feedback(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    type_: FeedbackType,
    status: FeedbackStatus,
    featured: bool,
    title: str = "A title",
) -> Feedback:
    row = Feedback(
        feedback_id=uuid.uuid4(),
        user_id=user_id,
        type=type_,
        title=title,
        description="Some description text.",
        rating=5 if type_ == FeedbackType.RATING else None,
        status=status,
        featured=featured,
        created_at=datetime.now(tz=timezone.utc),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


class TestAdminUsers:
    async def test_anonymous_is_refused(self, client: AsyncClient):
        assert (await client.get("/api/v1/admin/users")).status_code == 401

    async def test_normal_user_is_refused(self, client: AsyncClient, regular_user):
        response = await client.get("/api/v1/admin/users", headers=_auth(regular_user))
        assert response.status_code == 403

    async def test_admin_is_allowed(self, client: AsyncClient, admin_user, regular_user):
        response = await client.get("/api/v1/admin/users", headers=_auth(admin_user))
        body = response.json()

        assert response.status_code == 200
        assert body["total"] >= 2
        assert {"data", "total", "page", "page_size", "has_next", "has_prev"} <= body.keys()

    async def test_no_credential_material_is_returned(
        self, client: AsyncClient, admin_user, regular_user
    ):
        response = await client.get("/api/v1/admin/users", headers=_auth(admin_user))

        raw = response.text
        for leak in ("password_hash", "password", "$argon2", "refresh_token"):
            assert leak not in raw

    async def test_role_filter(self, client: AsyncClient, admin_user, regular_user):
        response = await client.get(
            "/api/v1/admin/users?role=ADMIN", headers=_auth(admin_user)
        )
        body = response.json()

        assert response.status_code == 200
        assert all(row["role"] == "ADMIN" for row in body["data"])

    async def test_search_matches_email(self, client: AsyncClient, admin_user, regular_user):
        response = await client.get(
            f"/api/v1/admin/users?search={regular_user.email}", headers=_auth(admin_user)
        )
        body = response.json()

        assert response.status_code == 200
        assert body["total"] == 1
        assert body["data"][0]["email"] == regular_user.email

    @pytest.mark.parametrize("hostile", ["%", "_", "%%", "'", "' OR 1=1 --", "a%_b"])
    async def test_search_metacharacters_are_not_wildcards(
        self, client: AsyncClient, admin_user, regular_user, hostile
    ):
        """A LIKE metacharacter must be searched for, not interpreted."""
        response = await client.get(
            "/api/v1/admin/users", params={"search": hostile}, headers=_auth(admin_user)
        )

        assert response.status_code == 200
        # No seeded address contains these, so a correct escape returns nothing.
        assert response.json()["total"] == 0


class TestAdminDownloads:
    async def test_anonymous_is_refused(self, client: AsyncClient):
        assert (await client.get("/api/v1/admin/downloads")).status_code == 401

    async def test_normal_user_is_refused(self, client: AsyncClient, regular_user):
        response = await client.get(
            "/api/v1/admin/downloads", headers=_auth(regular_user)
        )
        assert response.status_code == 403

    async def test_admin_is_allowed(self, client: AsyncClient, admin_user):
        response = await client.get("/api/v1/admin/downloads", headers=_auth(admin_user))
        body = response.json()

        assert response.status_code == 200
        assert {"data", "total", "page", "page_size"} <= body.keys()

    async def test_address_and_agent_are_not_exposed(
        self, client: AsyncClient, admin_user
    ):
        response = await client.get("/api/v1/admin/downloads", headers=_auth(admin_user))

        assert "ip_address" not in response.text
        assert "user_agent" not in response.text


class TestPublicTestimonials:
    async def test_is_public(self, client: AsyncClient):
        assert (await client.get("/api/v1/feedback/testimonials")).status_code == 200

    async def test_only_featured_and_accepted_are_returned(
        self, client: AsyncClient, db, regular_user
    ):
        await _make_feedback(
            db, regular_user.user_id,
            type_=FeedbackType.TESTIMONIAL, status=FeedbackStatus.ACCEPTED,
            featured=True, title="APPROVED AND FEATURED",
        )
        # Every one of these fails at least one condition.
        await _make_feedback(
            db, regular_user.user_id,
            type_=FeedbackType.TESTIMONIAL, status=FeedbackStatus.ACCEPTED,
            featured=False, title="NOT FEATURED",
        )
        await _make_feedback(
            db, regular_user.user_id,
            type_=FeedbackType.TESTIMONIAL, status=FeedbackStatus.NEW,
            featured=True, title="NOT REVIEWED",
        )
        await _make_feedback(
            db, regular_user.user_id,
            type_=FeedbackType.BUG, status=FeedbackStatus.ACCEPTED,
            featured=True, title="A BUG REPORT",
        )

        body = (await client.get("/api/v1/feedback/testimonials")).json()
        titles = [row["title"] for row in body]

        assert titles == ["APPROVED AND FEATURED"]
        assert "NOT FEATURED" not in titles
        assert "NOT REVIEWED" not in titles
        assert "A BUG REPORT" not in titles

    async def test_carries_no_identifiers(self, client: AsyncClient, db, regular_user):
        await _make_feedback(
            db, regular_user.user_id,
            type_=FeedbackType.TESTIMONIAL, status=FeedbackStatus.ACCEPTED,
            featured=True,
        )

        response = await client.get("/api/v1/feedback/testimonials")
        raw = response.text

        assert str(regular_user.user_id) not in raw
        assert regular_user.email not in raw
        for field in ("user_id", "feedback_id", "first_name", "last_name"):
            assert field not in raw

    async def test_unreviewed_feedback_never_leaks(
        self, client: AsyncClient, db, regular_user
    ):
        await _make_feedback(
            db, regular_user.user_id,
            type_=FeedbackType.BUG, status=FeedbackStatus.NEW, featured=False,
            title="CONFIDENTIAL CRASH REPORT",
        )

        response = await client.get("/api/v1/feedback/testimonials")

        assert response.json() == []
        assert "CONFIDENTIAL" not in response.text


class TestResendVerification:
    async def test_unverified_address_gets_200(self, client: AsyncClient, unverified_user):
        response = await client.post(
            "/api/v1/auth/resend-verification", json={"email": unverified_user.email}
        )
        assert response.status_code == 200

    async def test_unknown_address_gets_the_same_200(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/resend-verification", json={"email": "nobody@example.com"}
        )
        assert response.status_code == 200

    async def test_the_two_answers_are_indistinguishable(
        self, client: AsyncClient, unverified_user
    ):
        """Otherwise the form becomes an account-enumeration oracle."""
        known = await client.post(
            "/api/v1/auth/resend-verification", json={"email": unverified_user.email}
        )
        unknown = await client.post(
            "/api/v1/auth/resend-verification", json={"email": "nobody@example.com"}
        )

        assert known.status_code == unknown.status_code
        assert known.json() == unknown.json()

    async def test_no_token_is_returned(self, client: AsyncClient, unverified_user):
        response = await client.post(
            "/api/v1/auth/resend-verification", json={"email": unverified_user.email}
        )
        assert "token" not in response.text.lower()


class TestRateLimiting:
    """
    The limiter is disabled for the rest of the suite (see conftest), so this
    class turns it back on and confirms it genuinely refuses. Without this, the
    convenience of order-independent tests would quietly cost the coverage of a
    control that exists to slow down credential attacks.
    """

    @pytest.fixture(autouse=True)
    def _enable_limiter(self):
        from app.middleware.rate_limit import limiter

        limiter.enabled = True
        limiter.reset()
        yield
        limiter.enabled = False
        limiter.reset()

    async def test_resend_verification_is_rate_limited(
        self, client: AsyncClient, unverified_user
    ):
        payload = {"email": unverified_user.email}
        statuses = [
            (await client.post("/api/v1/auth/resend-verification", json=payload)).status_code
            for _ in range(6)
        ]

        assert 200 in statuses, "the first requests should be served"
        assert 429 in statuses, "the limiter should refuse once the budget is spent"

    async def test_a_refusal_does_not_leak_internals(
        self, client: AsyncClient, unverified_user
    ):
        payload = {"email": unverified_user.email}
        last = None
        for _ in range(8):
            last = await client.post("/api/v1/auth/resend-verification", json=payload)

        if last.status_code == 429:
            body = last.json()
            assert body["success"] is False
            assert "Too many requests" in body["error"]
            assert "Retry-After" in last.headers
