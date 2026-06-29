"""
app/tests/test_releases.py
───────────────────────────
Tests for the release endpoints (public and admin).
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.release import Release, ReleaseStatus
from app.tests.conftest import get_auth_headers

pytestmark = pytest.mark.asyncio


async def _create_published_release(db: AsyncSession, user_id: uuid.UUID) -> Release:
    release = Release(
        release_id=uuid.uuid4(),
        version="1.0.0",
        title="Test Release",
        release_notes="Initial release.",
        file_path="/data/releases/v1.0.0.zip",
        file_size=1024000,
        sha256_checksum="a" * 64,
        published_by_user_id=user_id,
        release_status=ReleaseStatus.PUBLISHED,
        is_latest=True,
    )
    db.add(release)
    await db.commit()
    await db.refresh(release)
    return release


class TestPublicReleases:
    async def test_list_releases_public(
        self, client: AsyncClient, db: AsyncSession, regular_user
    ):
        await _create_published_release(db, regular_user.user_id)
        response = await client.get("/api/v1/releases")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert data["total"] >= 1

    async def test_list_releases_no_auth_required(self, client: AsyncClient):
        """Public endpoint — no auth needed."""
        response = await client.get("/api/v1/releases")
        assert response.status_code == 200

    async def test_get_latest(
        self, client: AsyncClient, db: AsyncSession, regular_user
    ):
        await _create_published_release(db, regular_user.user_id)
        response = await client.get("/api/v1/releases/latest")
        assert response.status_code == 200

    async def test_get_release_by_id(
        self, client: AsyncClient, db: AsyncSession, regular_user
    ):
        release = await _create_published_release(db, regular_user.user_id)
        response = await client.get(f"/api/v1/releases/{release.release_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "1.0.0"
        # file_path must not be in public response
        assert "file_path" not in data

    async def test_get_nonexistent_release(self, client: AsyncClient):
        response = await client.get(f"/api/v1/releases/{uuid.uuid4()}")
        assert response.status_code == 404


class TestAdminReleases:
    async def test_create_release_as_admin(
        self, client: AsyncClient, admin_user
    ):
        response = await client.post(
            "/api/v1/admin/releases",
            json={
                "version": "2.0.0",
                "title": "Version 2",
                "release_notes": "Big release.",
                "file_path": "/data/releases/v2.0.0.zip",
                "file_size": 2048000,
                "sha256_checksum": "b" * 64,
            },
            headers=get_auth_headers(admin_user),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["version"] == "2.0.0"
        # Admin response includes file_path
        assert "file_path" in data

    async def test_create_release_regular_user_forbidden(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/admin/releases",
            json={
                "version": "3.0.0",
                "title": "Version 3",
                "release_notes": "Notes.",
                "file_path": "/data/releases/v3.0.0.zip",
                "file_size": 1024,
                "sha256_checksum": "c" * 64,
            },
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 403

    async def test_create_release_invalid_sha256(
        self, client: AsyncClient, admin_user
    ):
        response = await client.post(
            "/api/v1/admin/releases",
            json={
                "version": "4.0.0",
                "title": "Version 4",
                "release_notes": "Notes.",
                "file_path": "/data/releases/v4.0.0.zip",
                "file_size": 1024,
                "sha256_checksum": "not_a_valid_sha256",
            },
            headers=get_auth_headers(admin_user),
        )
        assert response.status_code == 422

    async def test_delete_release_as_admin(
        self, client: AsyncClient, db: AsyncSession, admin_user
    ):
        release = await _create_published_release(db, admin_user.user_id)
        response = await client.delete(
            f"/api/v1/admin/releases/{release.release_id}",
            headers=get_auth_headers(admin_user),
        )
        assert response.status_code == 204
