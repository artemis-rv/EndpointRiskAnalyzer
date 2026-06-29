"""
app/utils/email.py
───────────────────
Email sending abstraction layer.

Currently implemented as a structured log stub.
Replace the _send() implementation with SMTP / SendGrid / SES as needed.
The interface is stable — services call send_verification_email() etc.
"""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


async def _send(
    *,
    to_address: str,
    subject: str,
    html_body: str,
    text_body: str,
) -> None:
    """
    Internal send function.
    Logs in development; uses SMTP in production when configured.
    """
    if not settings.SMTP_HOST:
        # Development mode: log the email content (NOT the token)
        logger.info(
            "email_stub",
            to=to_address,
            subject=subject,
            note="SMTP not configured — email not sent",
        )
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
        msg["To"] = to_address
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(
                str(settings.EMAIL_FROM_ADDRESS), to_address, msg.as_string()
            )
        logger.info("email_sent", to=to_address, subject=subject)
    except Exception as exc:
        # Log failure but never bubble up — email is best-effort
        logger.error("email_send_failed", to=to_address, error=str(exc))


async def send_verification_email(
    *,
    to_address: str,
    user_id: str,
    token: str,
    base_url: str = "https://riskintel.example.com",
) -> None:
    """Send email verification link."""
    verify_url = f"{base_url}/verify-email?user_id={user_id}&token={token}"
    subject = "Verify your RiskIntel account"
    html_body = f"""
    <h2>Welcome to RiskIntel</h2>
    <p>Click the link below to verify your email address. This link expires in 24 hours.</p>
    <p><a href="{verify_url}">Verify Email</a></p>
    <p>If you did not register, ignore this email.</p>
    """
    text_body = (
        f"Verify your RiskIntel account:\n{verify_url}\n\n"
        "This link expires in 24 hours. If you did not register, ignore this email."
    )
    await _send(
        to_address=to_address, subject=subject, html_body=html_body, text_body=text_body
    )


async def send_password_reset_email(
    *,
    to_address: str,
    user_id: str,
    token: str,
    base_url: str = "https://riskintel.example.com",
) -> None:
    """Send password reset link."""
    reset_url = f"{base_url}/reset-password?user_id={user_id}&token={token}"
    subject = "Reset your RiskIntel password"
    html_body = f"""
    <h2>Password Reset Request</h2>
    <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
    <p><a href="{reset_url}">Reset Password</a></p>
    <p>If you did not request a password reset, ignore this email.</p>
    """
    text_body = (
        f"Reset your RiskIntel password:\n{reset_url}\n\n"
        "This link expires in 30 minutes. If you did not request a reset, ignore this email."
    )
    await _send(
        to_address=to_address, subject=subject, html_body=html_body, text_body=text_body
    )
