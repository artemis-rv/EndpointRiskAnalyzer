"""
app/tests/test_contact.py
──────────────────────────
Tests for the contact request endpoints.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.tests.conftest import get_auth_headers

pytestmark = pytest.mark.asyncio


class TestContact:
    async def test_create_contact_request(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/contact",
            json={
                "subject": "Need help with installation",
                "message": "I am having trouble installing the agent.",
                "category": "SUPPORT",
            },
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "NEW"
        assert data["category"] == "SUPPORT"

    async def test_create_contact_invalid_category(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/contact",
            json={
                "subject": "Test",
                "message": "Test message.",
                "category": "INVALID_CATEGORY",
            },
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 422

    async def test_contact_requires_auth(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/contact",
            json={
                "subject": "Test",
                "message": "Test message.",
                "category": "GENERAL",
            },
        )
        assert response.status_code == 401  # no credential supplied -> 401 (RFC 7235)

    async def test_list_my_contacts(self, client: AsyncClient, regular_user):
        response = await client.get(
            "/api/v1/contact/me",
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data


class TestAdminContact:
    async def test_admin_list_contacts(self, client: AsyncClient, admin_user):
        response = await client.get(
            "/api/v1/admin/contact",
            headers=get_auth_headers(admin_user),
        )
        assert response.status_code == 200

    async def test_regular_user_cannot_access_admin_contacts(
        self, client: AsyncClient, regular_user
    ):
        response = await client.get(
            "/api/v1/admin/contact",
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 403


class TestHealthEndpoints:
    async def test_liveness(self, client: AsyncClient):
        response = await client.get("/health/live")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_readiness(self, client: AsyncClient):
        response = await client.get("/health/ready")
        # 200 or 503 depending on DB availability in test env
        assert response.status_code in (200, 503)
