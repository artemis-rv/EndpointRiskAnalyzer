"""
app/models/__init__.py
───────────────────────
Re-exports all models so that Alembic's autogenerate can discover them.
"""

from app.models.contact_request import ContactRequest, ContactCategory, ContactStatus
from app.models.download import Download
from app.models.feedback import Feedback, FeedbackType, FeedbackStatus
from app.models.release import Release, ReleaseStatus
from app.models.user import User, UserRole

__all__ = [
    "User",
    "UserRole",
    "Release",
    "ReleaseStatus",
    "Download",
    "Feedback",
    "FeedbackType",
    "FeedbackStatus",
    "ContactRequest",
    "ContactCategory",
    "ContactStatus",
]
