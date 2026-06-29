"""
app/tests/conftest.py
──────────────────────
Pytest configuration and fixtures for the test suite.

Uses an in-memory SQLite database via aiosqlite for fast, isolated tests.
Each test function gets a clean database via function-scoped session fixture.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole

# ── Test database (SQLite in-memory) ─────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestSessionFactory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="session")
async def setup_database():
    """Create all tables once per test session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def db(setup_database) -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean session per test. Rolls back after each test."""
    async with TestSessionFactory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture()
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an HTTPX async test client with DB dependency overridden."""

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c

    app.dependency_overrides.clear()


# ── Helper fixtures ───────────────────────────────────────────────────────────
@pytest_asyncio.fixture()
async def regular_user(db: AsyncSession) -> User:
    """Create and persist a regular verified user."""
    user = User(
        user_id=uuid.uuid4(),
        first_name="Test",
        last_name="User",
        email="testuser@example.com",
        password_hash=hash_password("Str0ng!Password123"),
        country_code="US",
        role=UserRole.USER,
        email_verified=True,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture()
async def unverified_user(db: AsyncSession) -> User:
    """Create a user who has NOT verified their email."""
    user = User(
        user_id=uuid.uuid4(),
        first_name="Unverified",
        last_name="User",
        email="unverified@example.com",
        password_hash=hash_password("Str0ng!Password123"),
        country_code="US",
        role=UserRole.USER,
        email_verified=False,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture()
async def admin_user(db: AsyncSession) -> User:
    """Create and persist an admin user."""
    user = User(
        user_id=uuid.uuid4(),
        first_name="Admin",
        last_name="User",
        email="admin@example.com",
        password_hash=hash_password("Str0ng!Password123"),
        country_code="US",
        role=UserRole.ADMIN,
        email_verified=True,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def get_auth_headers(user: User) -> dict:
    """Generate Bearer token headers for a user."""
    from app.core.security import create_access_token

    token = create_access_token(
        subject=str(user.user_id), role=user.role.value
    )
    return {"Authorization": f"Bearer {token}"}
