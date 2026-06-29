"""
app/tests/test_auth.py
───────────────────────
Tests for the authentication endpoints.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


class TestRegister:
    async def test_register_success(self, client: AsyncClient, db: AsyncSession):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com",
                "password": "Str0ng!Password123",
                "country_code": "US",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "message" in data

    async def test_register_duplicate_email(
        self, client: AsyncClient, regular_user, db: AsyncSession
    ):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "first_name": "John",
                "last_name": "Doe",
                "email": "testuser@example.com",  # already exists
                "password": "Str0ng!Password123",
                "country_code": "US",
            },
        )
        assert response.status_code == 409

    async def test_register_weak_password(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "first_name": "John",
                "last_name": "Doe",
                "email": "weak@example.com",
                "password": "weak",
                "country_code": "US",
            },
        )
        assert response.status_code == 422

    async def test_register_invalid_email(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "first_name": "John",
                "last_name": "Doe",
                "email": "not-an-email",
                "password": "Str0ng!Password123",
                "country_code": "US",
            },
        )
        assert response.status_code == 422


class TestLogin:
    async def test_login_success(self, client: AsyncClient, regular_user):
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "Str0ng!Password123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, regular_user):
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "WrongPassword!123",
            },
        )
        assert response.status_code == 401

    async def test_login_nonexistent_email(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "Str0ng!Password123",
            },
        )
        assert response.status_code == 401

    async def test_login_returns_no_sensitive_fields(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "Str0ng!Password123",
            },
        )
        data = response.json()
        assert "password" not in data
        assert "password_hash" not in data


class TestRefresh:
    async def test_refresh_success(self, client: AsyncClient, regular_user):
        # Login first
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "Str0ng!Password123",
            },
        )
        refresh_token = login_resp.json()["refresh_token"]

        # Refresh
        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_resp.status_code == 200
        new_data = refresh_resp.json()
        assert "access_token" in new_data
        assert "refresh_token" in new_data

    async def test_refresh_invalid_token(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert response.status_code == 401


class TestPasswordReset:
    async def test_request_reset_always_200(self, client: AsyncClient):
        """Must return 200 even for non-existent emails (prevents enumeration)."""
        response = await client.post(
            "/api/v1/auth/request-password-reset",
            json={"email": "nobody@example.com"},
        )
        assert response.status_code == 200

    async def test_reset_with_invalid_token(self, client: AsyncClient, regular_user):
        response = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "token": "invalid_token",
                "user_id": str(regular_user.user_id),
                "new_password": "NewStr0ng!Pass123",
            },
        )
        assert response.status_code == 400


class TestVerifyEmail:
    async def test_verify_invalid_token(self, client: AsyncClient, regular_user):
        response = await client.post(
            "/api/v1/auth/verify-email",
            json={
                "token": "invalid_token",
                "user_id": str(regular_user.user_id),
            },
        )
        assert response.status_code == 400
