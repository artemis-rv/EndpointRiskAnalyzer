"""
endpoints.py

Read-only API routes for viewing registered endpoints.

Responsibilities:
- List all known endpoints
- Provide basic metadata and scan count

This module does NOT:
- Modify data
- Trigger scans
- Perform analysis
"""

from fastapi import APIRouter
from backend.db.mongo import (
    endpoints_collection,
    endpoint_scans_collection
)

router = APIRouter(prefix="/api/endpoints", tags=["Endpoints"])


@router.get("/")
def list_endpoints():
    """
    Returns all endpoints with basic metadata
    and number of scans collected per endpoint.
    """

    results = []

    endpoints = endpoints_collection().find()

    for ep in endpoints:
        endpoint_id = ep["_id"]

        scan_count = endpoint_scans_collection().count_documents(
            {"endpoint_id": endpoint_id}
        )

        results.append({
            "endpoint_id": str(endpoint_id),
            "hostname": ep.get("hostname"),
            "os": ep.get("os"),
            "last_seen": ep.get("last_seen"),
            "scan_count": scan_count
        })

    return {
        "total_endpoints": len(results),
        "endpoints": results
    }
