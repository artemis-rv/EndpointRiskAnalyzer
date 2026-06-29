"""
app/middleware/request_id.py
─────────────────────────────
Middleware that injects a unique Request-ID and Correlation-ID into every request.

- Request-ID:  generated fresh per request (UUID4)
- Correlation-ID: read from incoming X-Correlation-ID header if present, else = Request-ID
- Both IDs are bound to the structlog context so every log line in the request carries them
- Both IDs are echoed back in the response headers
"""

from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class RequestIDMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        correlation_id = request.headers.get("X-Correlation-ID", request_id)

        # Bind to structlog context for this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            correlation_id=correlation_id,
            method=request.method,
            path=request.url.path,
        )

        # Expose on request state for route handlers
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        response = await call_next(request)

        # Echo IDs back in response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Correlation-ID"] = correlation_id

        return response
