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

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter
from backend.db.mongo import (
    endpoints_collection,
    endpoint_scans_collection
)

router = APIRouter(prefix="/api/endpoints", tags=["Endpoints"])

# Consider agent active only if last_seen is within this many minutes (short = count drops soon after agent closes)
ACTIVE_AGENT_THRESHOLD_MINUTES = 2


def _is_agent_active(last_seen) -> bool:
    """True only if last_seen is in the past and within the last 2 minutes (avoids timezone/future bugs)."""
    if not last_seen:
        return False
    if isinstance(last_seen, datetime):
        dt = last_seen
    else:
        try:
            dt = datetime.fromisoformat(str(last_seen).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    delta = now - dt
    # Active only if last_seen is in the past and within threshold (not in future, not too old)
    return timedelta(0) < delta < timedelta(minutes=ACTIVE_AGENT_THRESHOLD_MINUTES)


@router.get("/")
def list_endpoints():
    """
    Returns all endpoints with basic metadata
    and number of scans collected per endpoint.
    """

    results = []

    endpoints = endpoints_collection().find()

    for ep in endpoints:
        # Scans may be stored by string endpoint_id (UUID) or by ObjectId (legacy)
        eid = ep.get("endpoint_id") or ep["_id"]
        scan_count = endpoint_scans_collection().count_documents({"endpoint_id": eid})
        last_seen = ep.get("last_seen")
        agent_active = _is_agent_active(last_seen)
        endpoint_id = ep.get("endpoint_id") or ep["_id"]

        results.append({
            "endpoint_id": str(endpoint_id),
            "hostname": ep.get("hostname"),
            "os": ep.get("os"),
            "last_seen": last_seen,
            "agent_active": agent_active,
            "scan_count": scan_count
        })

    return {
        "total_endpoints": len(results),
        "endpoints": results
    }
