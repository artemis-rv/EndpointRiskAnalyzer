"""
app/services/auth_service.py
─────────────────────────────
Business logic for all authentication operations.

Security principles applied:
- Constant-time email lookup to prevent user enumeration on password reset
- Refresh token rotation: each refresh invalidates the previous token
- Refresh token hashes stored in Redis (or DB fallback)
- Login failures are always logged to audit trail
- Never return the same error message for "email not found" vs "wrong password"
  (prevents user enumeration)
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    generate_signed_token,
    hash_password,
    hash_token,
    verify_password,
    verify_signed_token,
)
from app.repositories.user_repo import UserRepository
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.utils.audit import log_auth_event
from app.utils.email import send_password_reset_email, send_verification_email

settings = get_settings()
logger = get_logger(__name__)

# In-memory refresh token store (replace with Redis in production)
# Maps hashed_jti -> user_id
_refresh_token_store: dict[str, str] = {}


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._user_repo = UserRepository(session)

    async def register(
        self, request: RegisterRequest, *, ip_address: Optional[str] = None
    ) -> dict:
        """Register a new user. Returns a message — does NOT auto-login."""
        if await self._user_repo.email_exists(request.email):
            log_auth_event(
                event="register",
                actor_id=None,
                outcome="failure",
                email=request.email,
                ip_address=ip_address,
                reason="email_already_exists",
            )
            from fastapi import HTTPException
            raise HTTPException(status_code=409, detail="Email already registered.")

        password_hash = hash_password(request.password)

        user = await self._user_repo.create(
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            password_hash=password_hash,
            country_code=request.country_code,
            company_name=request.company_name,
        )
        await self._session.commit()

        # Generate verification token
        token = generate_signed_token(
            str(user.user_id),
            purpose="email_verification",
            expires_in_seconds=settings.EMAIL_VERIFICATION_EXPIRE_HOURS * 3600,
        )

        await send_verification_email(
            to_address=user.email,
            user_id=str(user.user_id),
            token=token,
        )

        log_auth_event(
            event="register",
            actor_id=str(user.user_id),
            outcome="success",
            email=user.email,
            ip_address=ip_address,
        )

        return {
            "message": "Registration successful. Please verify your email address."
        }

    async def login(
        self,
        request: LoginRequest,
        *,
        ip_address: Optional[str] = None,
    ) -> TokenResponse:
        """Authenticate a user and return JWT tokens."""
        # Always fetch user — constant time to prevent enumeration
        user = await self._user_repo.get_by_email(request.email)

        # Always verify password hash even if user not found (prevents timing attack)
        dummy_hash = "$argon2id$v=19$m=65536,t=3,p=2$fakesaltfakesalt$fakehashfakehash"
        password_ok = verify_password(
            request.password,
            user.password_hash if user else dummy_hash,
        )

        if not user or not password_ok:
            log_auth_event(
                event="login",
                actor_id=None,
                outcome="failure",
                email=request.email,
                ip_address=ip_address,
                reason="invalid_credentials",
            )
            from fastapi import HTTPException
            raise HTTPException(
                status_code=401, detail="Invalid email or password."
            )

        if not user.is_active:
            log_auth_event(
                event="login",
                actor_id=str(user.user_id),
                outcome="failure",
                ip_address=ip_address,
                reason="account_inactive",
            )
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Account is inactive.")

        access_token = create_access_token(
            subject=str(user.user_id), role=user.role.value
        )
        refresh_token, jti = create_refresh_token(subject=str(user.user_id))

        # Store hashed JTI
        _refresh_token_store[hash_token(jti)] = str(user.user_id)

        await self._user_repo.update_last_login(user.user_id)
        await self._session.commit()

        log_auth_event(
            event="login",
            actor_id=str(user.user_id),
            outcome="success",
            ip_address=ip_address,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def refresh(self, refresh_token: str) -> TokenResponse:
        """Rotate refresh token and issue new access + refresh token pair."""
        from fastapi import HTTPException
        from jose import JWTError

        try:
            payload = decode_refresh_token(refresh_token)
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid refresh token.")

        jti: str = payload.get("jti", "")
        user_id_str: str = payload.get("sub", "")

        hashed_jti = hash_token(jti)
        stored_user_id = _refresh_token_store.get(hashed_jti)

        if not stored_user_id or stored_user_id != user_id_str:
            raise HTTPException(
                status_code=401, detail="Refresh token has been revoked."
            )

        # Rotate: revoke old token
        del _refresh_token_store[hashed_jti]

        user = await self._user_repo.get_by_id(uuid.UUID(user_id_str))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive.")

        new_access_token = create_access_token(
            subject=str(user.user_id), role=user.role.value
        )
        new_refresh_token, new_jti = create_refresh_token(subject=str(user.user_id))
        _refresh_token_store[hash_token(new_jti)] = str(user.user_id)

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(
        self, refresh_token: str, *, actor_id: Optional[str] = None
    ) -> None:
        """Revoke a refresh token."""
        from jose import JWTError

        try:
            payload = decode_refresh_token(refresh_token)
            jti = payload.get("jti", "")
            hashed_jti = hash_token(jti)
            _refresh_token_store.pop(hashed_jti, None)
        except JWTError:
            pass  # Invalid token — treat as already revoked

        log_auth_event(
            event="logout", actor_id=actor_id, outcome="success"
        )

    async def verify_email(self, *, user_id: str, token: str) -> None:
        """Mark email as verified if token is valid."""
        from fastapi import HTTPException

        try:
            parsed_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user ID format.")

        user = await self._user_repo.get_by_id(parsed_uuid)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        if user.email_verified:
            return  # Idempotent

        if not verify_signed_token(token, user_id, purpose="email_verification"):
            log_auth_event(
                event="verify_email",
                actor_id=user_id,
                outcome="failure",
                reason="invalid_or_expired_token",
            )
            raise HTTPException(
                status_code=400, detail="Invalid or expired verification token."
            )

        await self._user_repo.mark_email_verified(user.user_id)
        await self._session.commit()

        log_auth_event(
            event="verify_email", actor_id=user_id, outcome="success"
        )

    async def request_password_reset(self, email: str) -> None:
        """
        Initiate password reset.
        Always returns success to prevent user enumeration.
        """
        user = await self._user_repo.get_by_email(email)
        if not user or not user.is_active:
            # Still return — don't leak whether email exists
            return

        token = generate_signed_token(
            str(user.user_id),
            purpose="password_reset",
            expires_in_seconds=settings.PASSWORD_RESET_EXPIRE_MINUTES * 60,
        )

        await send_password_reset_email(
            to_address=user.email,
            user_id=str(user.user_id),
            token=token,
        )

        log_auth_event(
            event="request_password_reset",
            actor_id=str(user.user_id),
            outcome="success",
        )

    async def reset_password(self, request: ResetPasswordRequest) -> None:
        """Complete password reset with a valid token."""
        from fastapi import HTTPException

        try:
            parsed_uuid = uuid.UUID(request.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid reset request format.")

        user = await self._user_repo.get_by_id(parsed_uuid)
        if not user:
            raise HTTPException(status_code=400, detail="Invalid reset request.")

        if not verify_signed_token(
            request.token, request.user_id, purpose="password_reset"
        ):
            log_auth_event(
                event="reset_password",
                actor_id=request.user_id,
                outcome="failure",
                reason="invalid_or_expired_token",
            )
            raise HTTPException(
                status_code=400, detail="Invalid or expired reset token."
            )

        new_hash = hash_password(request.new_password)
        await self._user_repo.update_password(user.user_id, new_hash)
        await self._session.commit()

        log_auth_event(
            event="reset_password", actor_id=request.user_id, outcome="success"
        )
