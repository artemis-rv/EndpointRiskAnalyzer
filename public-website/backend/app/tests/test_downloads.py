"""
app/tests/test_downloads.py
────────────────────────────
Tests for the download endpoints.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.release import Release, ReleaseStatus
from app.tests.conftest import get_auth_headers

pytestmark = pytest.mark.asyncio


async def _create_release(db: AsyncSession, user_id: uuid.UUID) -> Release:
    release = Release(
        release_id=uuid.uuid4(),
        version="1.2.3",
        title="DL Test Release",
        release_notes="Notes.",
        file_path="/data/v1.2.3.zip",
        file_size=500,
        sha256_checksum="d" * 64,
        published_by_user_id=user_id,
        release_status=ReleaseStatus.PUBLISHED,
        is_latest=False,
    )
    db.add(release)
    await db.commit()
    await db.refresh(release)
    return release


class TestDownloads:
    async def test_create_download_verified_user(
        self, client: AsyncClient, db: AsyncSession, regular_user
    ):
        release = await _create_release(db, regular_user.user_id)
        response = await client.post(
            "/api/v1/downloads",
            json={"release_id": str(release.release_id)},
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 201
        data = response.json()
        assert "download_id" in data
        # IP address must not be returned
        assert "ip_address" not in data
        assert "user_agent" not in data

    async def test_download_requires_verified_email(
        self, client: AsyncClient, db: AsyncSession, unverified_user
    ):
        release = await _create_release(db, unverified_user.user_id)
        response = await client.post(
            "/api/v1/downloads",
            json={"release_id": str(release.release_id)},
            headers=get_auth_headers(unverified_user),
        )
        assert response.status_code == 403

    async def test_download_requires_authentication(
        self, client: AsyncClient, db: AsyncSession, regular_user
    ):
        release = await _create_release(db, regular_user.user_id)
        response = await client.post(
            "/api/v1/downloads",
            json={"release_id": str(release.release_id)},
        )
        assert response.status_code == 401  # no credential supplied -> 401 (RFC 7235)

    async def test_download_nonexistent_release(
        self, client: AsyncClient, regular_user
    ):
        response = await client.post(
            "/api/v1/downloads",
            json={"release_id": str(uuid.uuid4())},
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 404

    async def test_list_my_downloads(
        self, client: AsyncClient, db: AsyncSession, regular_user
    ):
        response = await client.get(
            "/api/v1/downloads/me",
            headers=get_auth_headers(regular_user),
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
