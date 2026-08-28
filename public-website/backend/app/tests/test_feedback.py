"""
app/tests/test_feedback.py
───────────────────────────
Tests for the feedback endpoints.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.conftest import get_auth_headers

pytestmark = pytest.mark.asyncio


class TestFeedback:
    async def test_create_feedback_general(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/feedback",
            json={
                "type": "GENERAL",
                "title": "Great product!",
                "description": "Really impressed with RiskIntel.",
            },
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "NEW"
        assert data["featured"] is False

    async def test_create_rating_feedback_with_rating(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/feedback",
            json={
                "type": "RATING",
                "title": "My rating",
                "description": "5 stars!",
                "rating": 5,
            },
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 201

    async def test_rating_required_for_rating_type(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/feedback",
            json={
                "type": "RATING",
                "title": "Rating without score",
                "description": "Oops, forgot the score.",
            },
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 422

    async def test_rating_not_allowed_for_non_rating_type(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/feedback",
            json={
                "type": "BUG",
                "title": "Bug report",
                "description": "Found a bug.",
                "rating": 3,
            },
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 422

    async def test_list_my_feedback(self, client: AsyncClient, regular_user):
        response = await client.get(
            "/api/v1/feedback/me",
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 200

    async def test_feedback_requires_auth(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/feedback",
            json={
                "type": "GENERAL",
                "title": "Test",
                "description": "Test",
            },
        )
        assert response.status_code == 401  # no credential supplied -> 401 (RFC 7235)


class TestAdminFeedback:
    async def test_admin_list_feedback(self, client: AsyncClient, admin_user):
        response = await client.get(
            "/api/v1/admin/feedback",
            headers=get_auth_headers(admin_user),
        )
        assert response.status_code == 200

    async def test_regular_user_cannot_list_admin_feedback(
        self, client: AsyncClient, regular_user
    ):
        response = await client.get(
            "/api/v1/admin/feedback",
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 403
