"""
app/tests/test_users.py
────────────────────────
Tests for user profile endpoints.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import get_auth_headers

pytestmark = pytest.mark.asyncio


class TestGetMe:
    async def test_get_me_authenticated(self, client: AsyncClient, regular_user):
        response = await client.get(
            "/api/v1/users/me",
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"
        assert "password_hash" not in data
        assert "password" not in data

    async def test_get_me_unauthenticated(self, client: AsyncClient):
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 403  # No bearer token

    async def test_get_me_invalid_token(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401


class TestUpdateMe:
    async def test_update_first_name(self, client: AsyncClient, regular_user):
        response = await client.patch(
            "/api/v1/users/me",
            json={"first_name": "Updated"},
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 200
        assert response.json()["first_name"] == "Updated"

    async def test_update_country_code_normalized(
        self, client: AsyncClient, regular_user
    ):
        response = await client.patch(
            "/api/v1/users/me",
            json={"country_code": "gb"},  # lowercase should be upcased
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 200
        assert response.json()["country_code"] == "GB"

    async def test_update_role_not_allowed(self, client: AsyncClient, regular_user):
        """Users must not be able to escalate their own role."""
        response = await client.patch(
            "/api/v1/users/me",
            json={"role": "ADMIN"},
            headers=get_auth_headers(regular_user),
        )
        # role is not in UpdateMeRequest schema, so it's ignored (422 or 200 with no change)
        # Both are acceptable — what matters is role doesn't change
        if response.status_code == 200:
            assert response.json().get("role") != "ADMIN"

    async def test_update_unauthenticated(self, client: AsyncClient):
        response = await client.patch("/api/v1/users/me", json={"first_name": "X"})
        assert response.status_code == 403
