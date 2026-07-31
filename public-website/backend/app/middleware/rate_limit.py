"""
app/middleware/rate_limit.py
─────────────────────────────
Rate limiting configuration using slowapi (Starlette-native limiter).

Security:
- Client IP is derived from the socket peer address UNLESS the peer is a
  configured trusted proxy — only then is X-Forwarded-For honoured and the
  rightmost non-trusted IP in the chain is used.
- This prevents brute-force bypass via X-Forwarded-For header rotation.
  (FINDING-FZ-001 — HIGH)
"""

from __future__ import annotations

import ipaddress
from typing import Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings

settings = get_settings()

# Build a set of trusted proxy networks from config once at import time
_TRUSTED_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
for _cidr in settings.TRUSTED_PROXIES:
    try:
        _TRUSTED_NETWORKS.append(ipaddress.ip_network(_cidr, strict=False))
    except ValueError:
        pass  # misconfigured entries are silently skipped — fail safe


def _is_trusted_proxy(ip_str: Optional[str]) -> bool:
    """Return True if *ip_str* falls within any configured trusted proxy network."""
    if not ip_str:
        return False
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return any(addr in net for net in _TRUSTED_NETWORKS)


def _get_client_ip(request: Request) -> str:
    """
    Derive the real client IP in a spoofing-resistant way.

    Algorithm (OWASP recommended):
    1. Start with the direct socket peer (request.client.host).
    2. If the peer is NOT a trusted proxy → use it directly (ignore XFF).
    3. If the peer IS a trusted proxy → inspect X-Forwarded-For and walk the
       list right-to-left, stopping at the first non-trusted IP.  That IP is
       the real client.  If the whole chain is trusted proxies, fall back to
       the peer address.

    This means an attacker can never inject a fake IP unless they are already
    sitting behind one of our trusted proxies.
    """
    peer_ip: Optional[str] = request.client.host if request.client else None

    if not _is_trusted_proxy(peer_ip):
        # Direct connection or untrusted intermediary — never honour XFF
        return peer_ip or "unknown"

    # Peer is a trusted proxy: evaluate the XFF chain
    xff_header = request.headers.get("X-Forwarded-For", "")
    if xff_header:
        # XFF is ordered left=client … right=last-proxy; walk right-to-left
        # to find the first IP that is NOT one of our trusted proxies.
        candidates = [ip.strip() for ip in xff_header.split(",")]
        for candidate in reversed(candidates):
            if not _is_trusted_proxy(candidate):
                return candidate

    # Every address in the chain was trusted — fall back to the peer
    return peer_ip or "unknown"


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

