"""
app/utils/audit.py
───────────────────
Structured audit logging for security-sensitive events.

All audit events are written as structured JSON log entries with:
- event type
- actor (user_id or "anonymous")
- outcome (success/failure)
- target resource
- request metadata (IP, request_id)

Never logs passwords, tokens, or secrets.
"""

from __future__ import annotations

from typing import Any, Optional

import structlog

_audit_logger = structlog.get_logger("audit")


def log_auth_event(
    *,
    event: str,
    actor_id: Optional[str],
    outcome: str,
    email: Optional[str] = None,
    ip_address: Optional[str] = None,
    request_id: Optional[str] = None,
    reason: Optional[str] = None,
    **extra: Any,
) -> None:
    """
    Log an authentication or authorisation event.

    Events: register, login, logout, refresh, verify_email,
            request_password_reset, reset_password, login_failed
    Outcomes: success, failure, blocked
    """
    _audit_logger.info(
        "auth_event",
        audit_event=event,
        actor_id=actor_id or "anonymous",
        outcome=outcome,
        email=email,
        ip_address=ip_address,
        request_id=request_id,
        reason=reason,
        **extra,
    )


def log_admin_action(
    *,
    event: str,
    actor_id: str,
    target_type: str,
    target_id: str,
    outcome: str,
    changes: Optional[dict] = None,
    request_id: Optional[str] = None,
) -> None:
    """
    Log an admin action (create/update/delete on privileged resources).

    Events: create_release, update_release, delete_release,
            update_feedback, update_contact
    """
    _audit_logger.info(
        "admin_action",
        audit_event=event,
        actor_id=actor_id,
        target_type=target_type,
        target_id=str(target_id),
        outcome=outcome,
        changes=changes or {},
        request_id=request_id,
    )


def log_download_event(
    *,
    actor_id: str,
    release_id: str,
    release_version: str,
    ip_address: Optional[str],
    outcome: str,
    request_id: Optional[str] = None,
) -> None:
    """Log a file download event."""
    _audit_logger.info(
        "download_event",
        actor_id=actor_id,
        release_id=release_id,
        release_version=release_version,
        ip_address=ip_address,
        outcome=outcome,
        request_id=request_id,
    )
