"""
app/core/logging.py
────────────────────
Structured JSON logging via structlog.

Features:
- JSON output in production, colourised console output in development
- Request-ID and Correlation-ID automatically injected into every log line
- Never logs passwords, tokens, or secrets (enforced via sanitiser)
- ISO-8601 timestamps
"""

from __future__ import annotations

import logging
import sys
from typing import Any, MutableMapping

import structlog
from structlog.types import EventDict, Processor

# ── Secret field sanitiser ────────────────────────────────────────────────────
_SENSITIVE_KEYS = frozenset(
    {
        "password",
        "password_hash",
        "new_password",
        "old_password",
        "token",
        "access_token",
        "refresh_token",
        "reset_token",
        "verification_token",
        "secret",
        "jwt_secret",
        "smtp_password",
        "authorization",
        "cookie",
        "set-cookie",
    }
)


def _sanitise_event(
    logger: Any, method: str, event_dict: EventDict
) -> EventDict:
    """Drop known sensitive keys from the event dict before rendering."""
    for key in list(event_dict.keys()):
        if key.lower() in _SENSITIVE_KEYS:
            event_dict[key] = "***REDACTED***"
    return event_dict


# ── Add severity field (compatible with Google Cloud Logging / Datadog) ────────
def _add_severity(logger: Any, method: str, event_dict: EventDict) -> EventDict:
    level = event_dict.get("level", method).upper()
    event_dict["severity"] = level
    return event_dict


def configure_logging(debug: bool = False) -> None:
    """
    Configure structlog and the standard-library root logger.
    Call once at application startup.
    """
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        _sanitise_event,
        _add_severity,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if debug:
        renderer: Processor = structlog.dev.ConsoleRenderer(colors=True)
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(logging.DEBUG if debug else logging.INFO)

    # Silence noisy third-party loggers
    for noisy in ("uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(
            logging.DEBUG if debug else logging.WARNING
        )


def get_logger(name: str = __name__) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger."""
    return structlog.get_logger(name)
