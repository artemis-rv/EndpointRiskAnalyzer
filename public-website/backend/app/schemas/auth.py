"""
app/schemas/auth.py
────────────────────
Pydantic v2 schemas for authentication endpoints.

Security notes:
- Password fields are never included in response models
- Tokens are never logged (enforced in logging module)
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class RegisterRequest(BaseModel):
    """Schema for POST /api/v1/auth/register"""
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)
    country_code: str = Field(min_length=2, max_length=10)
    company_name: Optional[str] = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

    @field_validator("country_code")
    @classmethod
    def uppercase_country_code(cls, v: str) -> str:
        return v.strip().upper()


class LoginRequest(BaseModel):
    """Schema for POST /api/v1/auth/login"""
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    """Returned after successful login or token refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expiry


class RefreshRequest(BaseModel):
    """Schema for POST /api/v1/auth/refresh"""
    refresh_token: str


class LogoutRequest(BaseModel):
    """Schema for POST /api/v1/auth/logout"""
    refresh_token: str


class VerifyEmailRequest(BaseModel):
    """Schema for POST /api/v1/auth/verify-email"""
    token: str
    user_id: str


class RequestPasswordResetRequest(BaseModel):
    """Schema for POST /api/v1/auth/request-password-reset"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema for POST /api/v1/auth/reset-password"""
    token: str
    user_id: str
    new_password: str = Field(min_length=12, max_length=72)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class MessageResponse(BaseModel):
    """Generic message-only response."""
    message: str
