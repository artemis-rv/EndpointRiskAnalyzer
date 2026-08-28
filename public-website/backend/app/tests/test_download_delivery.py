"""
app/tests/test_download_delivery.py
────────────────────────────────────
The secure download flow, end to end through the API.

Covers the chain the brief specifies: authentication, authorisation, email
verification, release validation, record creation, and file delivery — plus the
refusals at each step.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.download import Download
from app.models.release import Release, ReleaseStatus
from app.services import storage

ARTEFACT_BYTES = b"pretend installer payload"


def _auth(user) -> dict[str, str]:
    token = create_access_token(subject=str(user.user_id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def artefact_root(tmp_path, monkeypatch):
    root = tmp_path / "releases"
    root.mkdir()
    (root / "riskintel-3.0.0.tar.gz").write_bytes(ARTEFACT_BYTES)
    monkeypatch.setattr(storage.settings, "RELEASE_FILES_BASE_PATH", str(root))
    return root


async def _make_release(
    db: AsyncSession,
    publisher_id: uuid.UUID,
    *,
    status: ReleaseStatus = ReleaseStatus.PUBLISHED,
    file_path: str = "riskintel-3.0.0.tar.gz",
    file_size: int = len(ARTEFACT_BYTES),
    version: str = "3.0.0",
) -> Release:
    release = Release(
        release_id=uuid.uuid4(),
        version=version,
        title=f"RiskIntel {version}",
        description=None,
        release_notes="Notes.",
        file_path=file_path,
        file_size=file_size,
        sha256_checksum="a" * 64,
        release_status=status,
        is_latest=True,
        published_at=datetime.now(tz=timezone.utc),
        published_by_user_id=publisher_id,
    )
    db.add(release)
    await db.commit()
    await db.refresh(release)
    return release


class TestDownloadAuthorisation:
    async def test_anonymous_is_refused(self, client: AsyncClient, db, admin_user, artefact_root):
        release = await _make_release(db, admin_user.user_id)
        response = await client.get(f"/api/v1/downloads/{release.release_id}/file")
        assert response.status_code == 401

    async def test_unverified_email_is_refused(
        self, client: AsyncClient, db, admin_user, unverified_user, artefact_root
    ):
        release = await _make_release(db, admin_user.user_id)
        response = await client.get(
            f"/api/v1/downloads/{release.release_id}/file",
            headers=_auth(unverified_user),
        )
        assert response.status_code == 403

    async def test_verified_user_receives_the_file(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        release = await _make_release(db, admin_user.user_id)
        response = await client.get(
            f"/api/v1/downloads/{release.release_id}/file",
            headers=_auth(regular_user),
        )

        assert response.status_code == 200
        assert response.content == ARTEFACT_BYTES

    async def test_unpublished_release_reads_as_absent(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        """A draft must not be distinguishable from a release that never existed."""
        draft = await _make_release(
            db, admin_user.user_id, status=ReleaseStatus.DRAFT, version="4.0.0"
        )
        response = await client.get(
            f"/api/v1/downloads/{draft.release_id}/file", headers=_auth(regular_user)
        )
        assert response.status_code == 404

    async def test_unknown_release_is_404(
        self, client: AsyncClient, regular_user, artefact_root
    ):
        response = await client.get(
            f"/api/v1/downloads/{uuid.uuid4()}/file", headers=_auth(regular_user)
        )
        assert response.status_code == 404


class TestDeliveryHeaders:
    async def test_headers_describe_an_attachment(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        release = await _make_release(db, admin_user.user_id)
        response = await client.get(
            f"/api/v1/downloads/{release.release_id}/file", headers=_auth(regular_user)
        )

        disposition = response.headers["content-disposition"]
        assert "attachment" in disposition
        assert "riskintel-3.0.0" in disposition
        assert response.headers["content-type"] == "application/octet-stream"
        assert response.headers["x-content-type-options"] == "nosniff"

    async def test_no_filesystem_path_is_disclosed(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        release = await _make_release(db, admin_user.user_id)
        response = await client.get(
            f"/api/v1/downloads/{release.release_id}/file", headers=_auth(regular_user)
        )

        joined = " ".join(f"{k}: {v}" for k, v in response.headers.items())
        assert str(artefact_root) not in joined
        assert "releases/" not in response.headers["content-disposition"]


class TestMissingAndHostileArtefacts:
    async def test_missing_file_is_404_not_500(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        release = await _make_release(
            db, admin_user.user_id, file_path="not-on-disk.tar.gz", version="5.0.0"
        )
        response = await client.get(
            f"/api/v1/downloads/{release.release_id}/file", headers=_auth(regular_user)
        )

        assert response.status_code == 404
        assert "not-on-disk" not in response.text

    @pytest.mark.parametrize(
        "hostile", ["../../../../etc/passwd", "..\\..\\secret.env", "/etc/shadow"]
    )
    async def test_traversal_in_stored_path_is_refused(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root, hostile
    ):
        release = await _make_release(
            db, admin_user.user_id, file_path=hostile, version="6.0.0"
        )
        response = await client.get(
            f"/api/v1/downloads/{release.release_id}/file", headers=_auth(regular_user)
        )

        assert response.status_code in (404, 500)
        # Nothing from outside the root came back.
        assert b"root:" not in response.content

    async def test_size_mismatch_is_refused(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        """The row and the file must agree, or the published checksum is a lie."""
        release = await _make_release(
            db, admin_user.user_id, file_size=999_999, version="7.0.0"
        )
        response = await client.get(
            f"/api/v1/downloads/{release.release_id}/file", headers=_auth(regular_user)
        )
        assert response.status_code == 500


class TestDownloadRecords:
    async def test_delivery_creates_a_record(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        release = await _make_release(db, admin_user.user_id)

        await client.get(
            f"/api/v1/downloads/{release.release_id}/file", headers=_auth(regular_user)
        )

        rows = (
            await db.execute(select(Download).where(Download.release_id == release.release_id))
        ).scalars().all()

        assert len(rows) == 1
        record = rows[0]
        assert record.user_id == regular_user.user_id
        assert record.release_id == release.release_id
        assert record.download_source == "website"
        assert record.downloaded_at is not None

    async def test_a_refused_request_records_nothing(
        self, client: AsyncClient, db, admin_user, unverified_user, artefact_root
    ):
        release = await _make_release(db, admin_user.user_id)

        await client.get(
            f"/api/v1/downloads/{release.release_id}/file",
            headers=_auth(unverified_user),
        )

        count = (
            await db.execute(select(func.count(Download.download_id)))
        ).scalar_one()
        assert count == 0

    async def test_a_missing_file_records_nothing(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        release = await _make_release(
            db, admin_user.user_id, file_path="absent.tar.gz", version="8.0.0"
        )

        await client.get(
            f"/api/v1/downloads/{release.release_id}/file", headers=_auth(regular_user)
        )

        count = (
            await db.execute(select(func.count(Download.download_id)))
        ).scalar_one()
        assert count == 0

    async def test_rapid_retry_does_not_duplicate(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        release = await _make_release(db, admin_user.user_id)

        for _ in range(3):
            await client.get(
                f"/api/v1/downloads/{release.release_id}/file",
                headers=_auth(regular_user),
            )

        count = (
            await db.execute(select(func.count(Download.download_id)))
        ).scalar_one()
        assert count == 1

    async def test_history_shows_the_download(
        self, client: AsyncClient, db, admin_user, regular_user, artefact_root
    ):
        release = await _make_release(db, admin_user.user_id)
        await client.get(
            f"/api/v1/downloads/{release.release_id}/file", headers=_auth(regular_user)
        )

        response = await client.get(
            "/api/v1/downloads/me", headers=_auth(regular_user)
        )
        body = response.json()

        assert response.status_code == 200
        assert body["total"] == 1
        # Privacy: the address and browser are recorded, never returned.
        assert "ip_address" not in body["data"][0]
        assert "user_agent" not in body["data"][0]
