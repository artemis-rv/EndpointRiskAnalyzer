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

    # ── Middleware ────────────────────────────────────────────────────────────
    #
    # ORDERING, PRECISELY
    # `add_middleware` PREPENDS, so the LAST call below is the OUTERMOST layer.
    # The resulting stack, outermost first, is:
    #
    #     ServerErrorMiddleware   (Starlette, always outermost)
    #       _BodySizeLimitMiddleware
    #         CORSMiddleware
    #           SecurityHeadersMiddleware
    #             RequestIDMiddleware
    #               _CatchAllExceptionMiddleware   ← added first, so innermost
    #                 ExceptionMiddleware (Starlette)
    #                   routes
    #
    # Why the catch-all sits at the bottom: an unhandled exception that escapes
    # to Starlette's ServerErrorMiddleware produces a response *outside* the CORS
    # layer, so it carries no Access-Control-Allow-Origin header. The browser
    # then reports a CORS failure instead of a 500, and the frontend cannot tell
    # "the server broke" from "the server is unreachable".
    #
    # Catching below CORS turns the same failure into an ordinary JSON response
    # that travels back out through CORS and picks up its headers.

    # 1. Catch-all — innermost, so its response passes back through CORS.
    app.add_middleware(_CatchAllExceptionMiddleware)

    # 2. Request ID / Correlation ID (runs before the catch-all on the way in,
    #    so request.state.request_id is populated for the error response)
    app.add_middleware(RequestIDMiddleware)

    # 3. Security headers
    app.add_middleware(
        SecurityHeadersMiddleware,
        production=settings.is_production,
    )

    # 4. CORS
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
        # Only a handful of response headers are readable cross-origin by
        # default, and Content-Disposition is not one of them. Without exposing
        # it the download page cannot read the filename the server chose and
        # falls back to a generic name — the file arrives correctly but saves
        # under the wrong one.
        expose_headers=[
            "X-Request-ID",
            "X-Correlation-ID",
            "Content-Disposition",
        ],
        max_age=600,
    )

    # 5. Request body size limit
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


# ── Catch-all exception middleware ────────────────────────────────────────────
class _CatchAllExceptionMiddleware(BaseHTTPMiddleware):
    """
    Converts any unhandled exception into the standard error envelope.

    This exists so that a 500 is produced *inside* the CORS layer. Starlette's
    own ServerErrorMiddleware sits outside every user middleware, so a response
    it generates never passes through CORSMiddleware and therefore carries no
    Access-Control-Allow-Origin header. A browser sees that as a CORS failure
    rather than a server error, which hides real faults from the client.

    The response body is deliberately generic: no exception type, no message, no
    traceback, no SQL. Everything useful for diagnosis goes to the server log,
    correlated by request_id, which is also the only detail returned so a person
    reporting a problem can quote it.
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:  # noqa: BLE001 — deliberately broad
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
