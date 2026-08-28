"""
scripts/seed_dev.py
────────────────────
Create development accounts and a downloadable release.

WHY THIS EXISTS
Email verification is required before an account can download, and SMTP is not
configured in development — the mailer logs a stub and deliberately never logs
the token. There is therefore no way to complete the verification step locally
without either wiring up a mail server or setting the flag directly. This script
does the latter, in one obvious place, rather than adding a development bypass
to the application itself.

SAFETY
- refuses to run when APP_ENV is production
- idempotent: re-running updates the existing rows instead of duplicating them
- passwords are hashed with the same Argon2id function the API uses; no
  plaintext is ever written to the database
- the artefact it writes is a clearly-labelled placeholder, not a real build

Usage:
    python scripts/seed_dev.py
"""

from __future__ import annotations

import asyncio
import hashlib
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import AsyncSessionFactory  # noqa: E402
from app.models.release import Release, ReleaseStatus  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

settings = get_settings()

# ── Development credentials ──────────────────────────────────────────────────
ADMIN_EMAIL = "admin@riskintel.io"
ADMIN_PASSWORD = "Admin-Riskintel-2026!"
USER_EMAIL = "user@riskintel.io"
USER_PASSWORD = "User-Riskintel-2026!"
UNVERIFIED_EMAIL = "unverified@riskintel.io"
UNVERIFIED_PASSWORD = "Unverified-Riskintel-2026!"

RELEASE_VERSION = "1.0.0"
ARTEFACT_NAME = "riskintel-1.0.0.tar.gz"

PLACEHOLDER_BODY = (
    b"RiskIntel development placeholder artefact.\n"
    b"This file exists so the download endpoint has something real to stream\n"
    b"during local development and testing. It is not a product build.\n"
)


def _abort_if_production() -> None:
    if settings.is_production:
        raise SystemExit("Refusing to seed: APP_ENV is production.")


async def _upsert_user(
    session,
    *,
    email: str,
    first_name: str,
    last_name: str,
    password: str,
    role: UserRole,
    verified: bool,
) -> User:
    existing = (
        await session.execute(select(User).where(User.email == email))
    ).scalars().first()

    now = datetime.now(tz=timezone.utc)
    password_hash = hash_password(password)

    if existing:
        existing.first_name = first_name
        existing.last_name = last_name
        existing.password_hash = password_hash
        existing.role = role
        existing.email_verified = verified
        existing.email_verified_at = now if verified else None
        existing.is_active = True
        existing.updated_at = now
        print(f"  updated  {email:<28} role={role.value:<11} verified={verified}")
        return existing

    user = User(
        user_id=uuid.uuid4(),
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=password_hash,
        country_code="GB",
        company_name="RiskIntel Development",
        role=role,
        email_verified=verified,
        email_verified_at=now if verified else None,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    session.add(user)
    await session.flush()
    print(f"  created  {email:<28} role={role.value:<11} verified={verified}")
    return user


def _write_artefact() -> tuple[Path, int, str]:
    """Write the placeholder artefact and return (path, size, sha256)."""
    root = Path(settings.RELEASE_FILES_BASE_PATH).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)

    artefact = root / ARTEFACT_NAME
    artefact.write_bytes(PLACEHOLDER_BODY)

    digest = hashlib.sha256(PLACEHOLDER_BODY).hexdigest()
    return artefact, len(PLACEHOLDER_BODY), digest


async def _upsert_release(session, *, publisher: User) -> Release:
    artefact, size, checksum = _write_artefact()
    now = datetime.now(tz=timezone.utc)

    existing = (
        await session.execute(
            select(Release).where(Release.version == RELEASE_VERSION)
        )
    ).scalars().first()

    # The stored path is relative to the storage root. Storing it relative keeps
    # the database free of machine-specific absolute paths and means the root
    # can move without rewriting rows.
    relative_path = ARTEFACT_NAME

    if existing:
        existing.file_path = relative_path
        existing.file_size = size
        existing.sha256_checksum = checksum
        existing.release_status = ReleaseStatus.PUBLISHED
        existing.is_latest = True
        existing.published_at = existing.published_at or now
        existing.published_by_user_id = publisher.user_id
        existing.updated_at = now
        print(f"  updated  release v{RELEASE_VERSION} ({size} bytes)")
        return existing

    release = Release(
        release_id=uuid.uuid4(),
        version=RELEASE_VERSION,
        title=f"RiskIntel {RELEASE_VERSION}",
        description="Development build used for local end-to-end testing.",
        release_notes=(
            "Initial development release.\n"
            "- Endpoint inventory collection\n"
            "- Risk scoring\n"
            "- Ranked remediation queue"
        ),
        file_path=relative_path,
        file_size=size,
        sha256_checksum=checksum,
        release_status=ReleaseStatus.PUBLISHED,
        is_latest=True,
        published_at=now,
        published_by_user_id=publisher.user_id,
        created_at=now,
        updated_at=now,
    )
    session.add(release)
    await session.flush()
    print(f"  created  release v{RELEASE_VERSION} ({size} bytes)")
    return release


async def main() -> None:
    _abort_if_production()

    print(f"Seeding {settings.APP_ENV} database...\n")
    async with AsyncSessionFactory() as session:
        admin = await _upsert_user(
            session,
            email=ADMIN_EMAIL,
            first_name="Grace",
            last_name="Hopper",
            password=ADMIN_PASSWORD,
            role=UserRole.ADMIN,
            verified=True,
        )
        await _upsert_user(
            session,
            email=USER_EMAIL,
            first_name="Ada",
            last_name="Lovelace",
            password=USER_PASSWORD,
            role=UserRole.USER,
            verified=True,
        )
        await _upsert_user(
            session,
            email=UNVERIFIED_EMAIL,
            first_name="Alan",
            last_name="Turing",
            password=UNVERIFIED_PASSWORD,
            role=UserRole.USER,
            verified=False,
        )

        release = await _upsert_release(session, publisher=admin)
        await session.commit()

        print("\n" + "-" * 64)
        print("DEVELOPMENT CREDENTIALS")
        print("-" * 64)
        print(f"  Admin      {ADMIN_EMAIL}  /  {ADMIN_PASSWORD}")
        print(f"  User       {USER_EMAIL}  /  {USER_PASSWORD}")
        print(f"  Unverified {UNVERIFIED_EMAIL}  /  {UNVERIFIED_PASSWORD}")
        print("-" * 64)
        print(f"  Release    v{release.version}  ({release.release_id})")
        print(f"  Checksum   {release.sha256_checksum}")
        print("-" * 64)
        print("\nThese accounts exist only in this database. Never seed production.")


if __name__ == "__main__":
    asyncio.run(main())
