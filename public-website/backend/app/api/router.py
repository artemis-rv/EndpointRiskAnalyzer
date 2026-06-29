"""
app/api/router.py
──────────────────
Central router that aggregates all API sub-routers.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, contact, downloads, feedback, releases, users
from app.api.v1.admin import contact as admin_contact
from app.api.v1.admin import feedback as admin_feedback
from app.api.v1.admin import releases as admin_releases
from app.api.v1.health import router as health_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(releases.router)
api_router.include_router(downloads.router)
api_router.include_router(feedback.router)
api_router.include_router(contact.router)
api_router.include_router(admin_releases.router)
api_router.include_router(admin_feedback.router)
api_router.include_router(admin_contact.router)

# Health checks at /health/* (no /api/v1 prefix — for orchestrator probes)
health_api_router = APIRouter()
health_api_router.include_router(health_router)
