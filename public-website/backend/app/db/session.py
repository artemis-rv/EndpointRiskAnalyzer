"""
app/db/session.py
──────────────────
Async SQLAlchemy engine and session factory.

Design choices:
- Uses asyncpg driver for high-performance async PostgreSQL access
- Connection pool tuned for production (10 base + 20 overflow)
- Sessions are yielded as FastAPI dependencies
- No autocommit — every transaction is explicit
"""

from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,          # Log SQL only in debug mode (never in prod)
    pool_size=10,
    max_overflow=20,
    pool_timeout=10,              # Fail-fast: don't queue longer than 10s for a pool slot
    pool_recycle=1800,            # Recycle connections every 30 min
    pool_pre_ping=True,           # Verify connection health before use
    # FINDING-VA-002 (HIGH): Cap how long asyncpg blocks the event loop
    # waiting for a TCP handshake or a slow query response.
    # Without these, a dead/slow DB freezes the entire async event loop.
    connect_args={
        "timeout": 5,            # TCP connect + PostgreSQL handshake must complete within 5s
        "command_timeout": 10,   # Any individual query must complete within 10s
    },
)

# ── Session Factory ───────────────────────────────────────────────────────────
AsyncSessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,       # Prevent lazy-load after commit in async context
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an async database session.

    Usage:
        async def my_route(db: AsyncSession = Depends(get_db)): ...

    The session is always closed after the request, even on exceptions.
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
