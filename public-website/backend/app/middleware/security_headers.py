"""
app/middleware/security_headers.py
────────────────────────────────────
Middleware that injects OWASP-recommended security headers on every response.

Headers set:
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Content-Security-Policy
- Permissions-Policy
- Cache-Control (for API responses)
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, production: bool = False) -> None:
        super().__init__(app)
        self._production = production

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # ── HSTS (production only — not safe in dev/test) ──────────────────
        if self._production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        # ── Content type sniffing prevention ──────────────────────────────
        response.headers["X-Content-Type-Options"] = "nosniff"

        # ── Clickjacking prevention ────────────────────────────────────────
        response.headers["X-Frame-Options"] = "DENY"

        # ── Legacy XSS protection (belt + braces) ─────────────────────────
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # ── Referrer policy ───────────────────────────────────────────────
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # ── Content Security Policy ────────────────────────────────────────
        # Restrictive CSP for a pure API — no inline scripts/styles needed
        if not request.url.path.startswith(("/docs", "/redoc", "/openapi.json")):
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; "
                "frame-ancestors 'none';"
            )

        # ── Permissions Policy ────────────────────────────────────────────
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        # ── Cache control for API responses ──────────────────────────────
        # API responses should not be cached by default
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        # ── Remove server information ─────────────────────────────────────
        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        return response
