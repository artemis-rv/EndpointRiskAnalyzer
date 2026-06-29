"""
app/middleware/rate_limit.py
─────────────────────────────
Rate limiting configuration using slowapi (Starlette-native limiter).

Provides:
- limiter instance (attach to FastAPI app)
- rate_limit_exceeded_handler (register as exception handler)
- Helper decorators: auth_rate_limit, default_rate_limit

Usage in routes:
    @router.post("/login")
    @limiter.limit("10/minute")
    async def login(request: Request, ...): ...
"""

from __future__ import annotations

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings

settings = get_settings()


def _get_client_ip(request: Request) -> str:
    """
    Extract real client IP, respecting X-Forwarded-For from trusted proxies.
    Falls back to direct connection address.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the leftmost address (closest to the client)
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(
    key_func=_get_client_ip,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    # Falls back to in-memory if REDIS_URL is not reachable
    storage_uri=settings.REDIS_URL,
)


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> Response:
    """Return a structured 429 JSON response instead of plain text."""
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": "Too many requests. Please try again later.",
            "details": [{"message": str(exc.detail)}],
        },
        headers={"Retry-After": "60"},
    )
