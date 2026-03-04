"""
main.py

FastAPI application entry point.

Responsibilities:
- Initialize FastAPI app
- Verify database connectivity
- Register API routes (later)
- Expose basic health endpoints

This file intentionally avoids:
- Business logic
- Analysis logic
- Interpretation logic
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

from backend.db.mongo import db, ensure_database_exists

# Ensure database and collections exist (so Scan All and agent register work with empty DB)
ensure_database_exists()

from backend.routes.scans import router as scans_router
from backend.routes.endpoints import router as endpoints_router
from backend.routes.scans_read import router as scans_read_router
from backend.routes.analysis import router as analysis_router
from backend.services.interpretation import router as interpretation_router
from backend.routes.posture import router as posture_router
from backend.routes.interpretation_read import router as interpretation_read_router
from backend.routes.agent_jobs import router as agent_jobs_router
from backend.routes.job_scheduler import router as job_scheduler_router
from backend.routes.agent_register import router as agent_register_router
from backend.routes.report import router as report


# -------------------------------
# FastAPI App Initialization
# -------------------------------

app = FastAPI(
    title="Organizational Security Posture API",
    description="Backend API for posture analysis and interpretation",
    version="1.0.0"
)

# -------------------------------
# Security Middleware
# -------------------------------
# Redirect HTTP to HTTPS
import os
# Enforce HTTPS redirect only if explicitly enabled (useful for local dev without certs)
if os.getenv("ENFORCE_HTTPS", "false").lower() == "true":
    from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response

# -------------------------------
# CORS Configuration
# -------------------------------
# Allow common local development origins by default, extendable via environment
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://localhost:3000")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------
# Rate Limiting Configuration
# -------------------------------
from backend.limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# -------------------------------
# Health & Sanity Endpoints
# -------------------------------

@app.get("/health")
def health_check():
    """
    Simple health check endpoint.
    Confirms API is running.
    """
    return {"status": "ok"}


@app.get("/ping")
def ping():
    return {"pong": "pong"}


@app.get("/db-health")
def db_health_check():
    """
    Confirms MongoDB connectivity.
    """
    try:
        collections = db.list_collection_names()
        return {
            "database": "connected",
            "collections": collections
        }
    except Exception as e:
        return {
            "database": "error",
            "error": str(e)
        }




# -------------------------------
# Root Endpoint
# -------------------------------

@app.get("/")
def root():
    """
    Root endpoint for basic sanity.
    """
    return {
        "message": "Organizational Security Posture Backend is running"
    }

from backend.routes.ml_routes import router as ml_router
from backend.routes.analytics import router as analytics_charts_router
from backend.routes.contact import router as contact_router
from backend.routes.websockets import router as websockets_router
from backend.routes.dashboard import router as dashboard_router

app.include_router(scans_router)
app.include_router(endpoints_router)
app.include_router(scans_read_router)
app.include_router(analysis_router)
app.include_router(interpretation_router)
app.include_router(posture_router)
app.include_router(interpretation_read_router)
app.include_router(agent_jobs_router)
app.include_router(job_scheduler_router)
app.include_router(agent_register_router)
app.include_router(ml_router)
app.include_router(report)
app.include_router(analytics_charts_router)
app.include_router(contact_router)
app.include_router(websockets_router)
app.include_router(dashboard_router)


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="127.0.0.1", port=8000)

