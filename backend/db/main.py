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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.mongo import db

from backend.routes.scans import router as scans_router
from backend.routes.endpoints import router as endpoints_router
from backend.routes.scans_read import router as scans_read_router
from backend.routes.analysis import router as analysis_router
from backend.services.interpretation import router as interpretation_router
from backend.routes.posture import router as posture_router
from fastapi.middleware.cors import CORSMiddleware



# -------------------------------
# FastAPI App Initialization
# -------------------------------

app = FastAPI(
    title="Organizational Security Posture API",
    description="Backend API for posture analysis and interpretation",
    version="1.0.0"
)


# -------------------------------
# CORS Configuration
# -------------------------------
# Required later for React frontend

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

app.include_router(scans_router)
app.include_router(endpoints_router)
app.include_router(scans_read_router)
app.include_router(analysis_router)
app.include_router(interpretation_router)
app.include_router(posture_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

