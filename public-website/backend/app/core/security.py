"""
app/core/security.py
─────────────────────
All cryptographic operations live here.

Implements:
- Argon2id password hashing (OWASP recommended)
- JWT access token creation/verification
- JWT refresh token creation/verification
- Time-limited HMAC token generation (email verification, password reset)
- Constant-time string comparison helpers

SECURITY NOTES:
- Passwords are NEVER logged
- Tokens are NEVER logged
- All comparisons use constant-time algorithms to prevent timing attacks
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

# ── Argon2id Configuration ────────────────────────────────────────────────────
# OWASP ASVS 4.0 v3.4 recommends Argon2id with:
#   time_cost  >= 1
#   memory_cost >= 19 MiB (19456 KiB)
#   parallelism >= 1
_ph = PasswordHasher(
    time_cost=3,       # iterations
    memory_cost=65536, # 64 MiB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def hash_password(plain: str) -> str:
    """
    Hash a plaintext password with Argon2id.
    Returns the encoded hash string (includes salt and parameters).
    """
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a plaintext password against an Argon2id hash.
    Returns True on match, False on mismatch.
    Raises no exceptions — all exceptions are caught internally.
    """
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, Exception):
        return False


def password_needs_rehash(hashed: str) -> bool:
    """Return True if the hash needs to be upgraded (parameters changed)."""
    return _ph.check_needs_rehash(hashed)


# ── JWT Tokens ────────────────────────────────────────────────────────────────

_ACCESS_TOKEN_TYPE = "access"
_REFRESH_TOKEN_TYPE = "refresh"


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def create_access_token(
    subject: str,
    role: str,
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    """
    Create a short-lived JWT access token.

    Claims:
        sub  — user_id (UUID string)
        role — UserRole string
        type — "access"
        iat  — issued at
        exp  — expiry
        jti  — unique token ID (for future revocation)
    """
    now = _utcnow()
    expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": _ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": expire,
        "jti": secrets.token_hex(16),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(subject: str) -> tuple[str, str]:
    """
    Create a long-lived JWT refresh token.

    Returns:
        (raw_token, jti) — store a hash of jti in the DB/Redis for rotation.
    """
    now = _utcnow()
    expire = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    jti = secrets.token_hex(32)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": _REFRESH_TOKEN_TYPE,
        "iat": now,
        "exp": expire,
        "jti": jti,
    }
    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, jti


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT access token.
    Raises JWTError on any failure.
    """
    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    if payload.get("type") != _ACCESS_TOKEN_TYPE:
        raise JWTError("Token type mismatch.")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT refresh token.
    Raises JWTError on any failure.
    """
    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    if payload.get("type") != _REFRESH_TOKEN_TYPE:
        raise JWTError("Token type mismatch.")
    return payload


# ── HMAC One-Time Tokens (email verification, password reset) ─────────────────

def generate_signed_token(user_id: str, purpose: str, expires_in_seconds: int) -> str:
    """
    Generate a URL-safe, time-limited, HMAC-signed opaque token.

    Format (base16-encoded): <random_bytes>.<expiry_ts>.<hmac>
    - random_bytes: 32 random bytes (prevents brute force)
    - expiry_ts: Unix timestamp when token expires
    - hmac: HMAC-SHA256 over (purpose + user_id + random_bytes + expiry_ts)
    """
    random_part = secrets.token_hex(32)
    expiry_ts = int(time.time()) + expires_in_seconds
    message = f"{purpose}:{user_id}:{random_part}:{expiry_ts}"
    mac = hmac.new(
        key=settings.JWT_SECRET_KEY.encode(),
        msg=message.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return f"{random_part}.{expiry_ts}.{mac}"


def verify_signed_token(
    token: str,
    user_id: str,
    purpose: str,
) -> bool:
    """
    Verify a signed token.
    Returns True if valid and not expired, False otherwise.
    Uses constant-time comparison.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False
        random_part, expiry_ts_str, provided_mac = parts
        expiry_ts = int(expiry_ts_str)
        if int(time.time()) > expiry_ts:
            return False
        message = f"{purpose}:{user_id}:{random_part}:{expiry_ts_str}"
        expected_mac = hmac.new(
            key=settings.JWT_SECRET_KEY.encode(),
            msg=message.encode(),
            digestmod=hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected_mac, provided_mac)
    except Exception:
        return False


def hash_token(token: str) -> str:
    """Return SHA-256 hex digest of a token (for safe DB storage)."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── Password policy ────────────────────────────────────────────────────────────

def validate_password_strength(password: str) -> list[str]:
    """
    Returns a list of violations.  Empty list means the password is acceptable.

    Policy (OWASP-aligned):
    - Minimum 12 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit
    - At least 1 special character
    - Not more than 72 characters (Argon2 practical limit)
    """
    errors: list[str] = []
    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")
    if len(password) > 72:
        errors.append("Password must not exceed 72 characters.")
    if not any(c.isupper() for c in password):
        errors.append("Password must contain at least one uppercase letter.")
    if not any(c.islower() for c in password):
        errors.append("Password must contain at least one lowercase letter.")
    if not any(c.isdigit() for c in password):
        errors.append("Password must contain at least one digit.")
    if not any(c in r"!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in password):
        errors.append("Password must contain at least one special character.")
    return errors
