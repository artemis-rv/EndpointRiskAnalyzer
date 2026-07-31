"""
app/api/v1/health.py
─────────────────────
Health check endpoints for liveness and readiness probes.

/health/live   — lightweight: just confirms the process is running
/health/ready  — checks database connectivity
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db

router = APIRouter(prefix="/health", tags=["Health"])
settings = get_settings()


@router.get(
    "/live",
    summary="Liveness probe — is the process alive?",
    response_class=JSONResponse,
    status_code=status.HTTP_200_OK,
)
async def liveness() -> dict:
    # FINDING-VA-005 (INFO): Suppress version banner in production to reduce
    # information disclosure that aids fingerprinting / targeted exploitation.
    if settings.is_production:
        return {"status": "ok", "service": settings.APP_NAME}
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}


@router.get(
    "/ready",
    summary="Readiness probe — is the database reachable?",
    response_class=JSONResponse,
)
async def readiness(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    try:
        await db.execute(text("SELECT 1"))
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ready", "database": "ok"},
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "database": "unreachable"},
        )
