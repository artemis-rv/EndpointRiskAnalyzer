"""
app/main.py
────────────
FastAPI application factory and startup configuration.

Security hardening applied:
- CORS restricted to configured allowlist
- Request body size limited (prevents DoS)
- Security headers on every response
- Rate limiting via slowapi
- Global exception handlers (never leak stack traces)
- Request ID + structured logging
- OpenAPI documentation disabled in production
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.router import api_router, health_api_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware

settings = get_settings()
configure_logging(debug=settings.DEBUG)
logger = get_logger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    logger.info(
        "startup",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        env=settings.APP_ENV,
    )
    yield
    logger.info("shutdown", app=settings.APP_NAME)


# ── Application Factory ───────────────────────────────────────────────────────
def create_application() -> FastAPI:
    _docs_url = "/docs" if not settings.is_production else None
    _redoc_url = "/redoc" if not settings.is_production else None
    _openapi_url = "/openapi.json" if not settings.is_production else None

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "RiskIntel Public Website API — "
            "User registration, authentication, release browsing, "
            "downloads, feedback, and contact requests."
        ),
        docs_url=_docs_url,
        redoc_url=_redoc_url,
        openapi_url=_openapi_url,
        lifespan=lifespan,
    )

    # ── Rate limiter state ────────────────────────────────────────────────────
    app.state.limiter = limiter

    # ── Middleware (order matters — outermost applied first) ──────────────────

    # 1. Request ID / Correlation ID (must be first so IDs appear in all logs)
    app.add_middleware(RequestIDMiddleware)

    # 2. Security headers
    app.add_middleware(
        SecurityHeadersMiddleware,
        production=settings.is_production,
    )

    # 3. CORS
    # FINDING-VA-006 (INFO): allow_credentials=True is ONLY safe when origins
    # are an explicit allowlist — never when "*" is present. If a wildcard were
    # ever added, the combination would allow any site to make credentialed
    # cross-origin requests (data-theft primitive). Guard below enforces this.
    _allow_credentials = "*" not in settings.CORS_ORIGINS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=_allow_credentials,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
        expose_headers=["X-Request-ID", "X-Correlation-ID"],
        max_age=600,
    )

    # 4. Request body size limit
    app.add_middleware(
        _BodySizeLimitMiddleware,
        max_bytes=settings.MAX_REQUEST_SIZE,
    )

    # ── Exception Handlers ────────────────────────────────────────────────────
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)
    app.add_exception_handler(Exception, _unhandled_exception_handler)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_router)
    app.include_router(health_api_router)

    return app


# ── Body size limit middleware ────────────────────────────────────────────────
class _BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_bytes: int) -> None:
        super().__init__(app)
        self._max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("Content-Length")
        if content_length and int(content_length) > self._max_bytes:
            return JSONResponse(
                status_code=413,
                content={
                    "success": False,
                    "error": "Request body too large.",
                    "details": [
                        {
                            "message": f"Maximum allowed size is {self._max_bytes} bytes."
                        }
                    ],
                },
            )
        return await call_next(request)


# ── Global Exception Handlers ─────────────────────────────────────────────────
async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Translate HTTP exceptions into standardised JSON responses."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "request_id": request_id,
        },
    )


async def _validation_exception_handler(
    request: Request, exc: RequestValidationError
):
    """Translate Pydantic validation errors into structured JSON."""
    request_id = getattr(request.state, "request_id", None)
    details = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error.get("loc", []) if loc != "body")
        details.append({"field": field or None, "message": error["msg"]})

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "Validation failed.",
            "details": details,
            "request_id": request_id,
        },
    )


async def _unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unexpected errors.
    NEVER exposes internal details, stack traces, or SQL errors.
    """
    request_id = getattr(request.state, "request_id", None)
    logger.error(
        "unhandled_exception",
        exc_type=type(exc).__name__,
        request_id=request_id,
        path=request.url.path,
        method=request.method,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "An internal server error occurred.",
            "request_id": request_id,
        },
    )


# ── Application instance ──────────────────────────────────────────────────────
app = create_application()
