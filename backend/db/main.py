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
