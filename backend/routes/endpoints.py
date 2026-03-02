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


from bson import ObjectId
from backend.services.remediation_data import get_remediation_for_control

@router.get("/{endpoint_id}")
def get_endpoint_detail(endpoint_id: str):
    """
    Returns full details for a specific endpoint, including its latest scan,
    and enriches failed CIS controls with remediation strategies.
    """
    # 1. Fetch Endpoint Metadata
    endpoint = endpoints_collection().find_one({"endpoint_id": endpoint_id})
    if not endpoint and ObjectId.is_valid(endpoint_id):
        endpoint = endpoints_collection().find_one({"_id": ObjectId(endpoint_id)})
        
    if not endpoint:
        return {"status": "error", "message": "Endpoint not found"}

    # 2. Fetch Latest Scan
    eid = endpoint.get("endpoint_id") or endpoint["_id"]
    latest_scan = endpoint_scans_collection().find_one(
        {"endpoint_id": eid},
        sort=[("scan_time", -1)]
    )

    if not latest_scan:
        return {
            "status": "success",
            "endpoint": {
                "endpoint_id": str(eid),
                "hostname": endpoint.get("hostname"),
                "os": endpoint.get("os"),
                "last_seen": endpoint.get("last_seen"),
                "agent_active": _is_agent_active(endpoint.get("last_seen"))
            },
            "latest_scan": None
        }
        
    scan_data = latest_scan.get("scan_data", {})
    
    # 3. Enrich Failed Controls with Remediation Metadata
    cis_data = scan_data.get("cis_compliance", {})
    controls = cis_data.get("controls", [])
    
    for control in controls:
        status = str(control.get("status", "")).lower()
        if status in {"non_compliant", "non-compliant"}:
            control_id = str(control.get("control_id", ""))
            remediation = get_remediation_for_control(control_id)
            control["remediation"] = remediation

    return {
        "status": "success",
        "endpoint": {
            "endpoint_id": str(eid),
            "hostname": endpoint.get("hostname"),
            "os": endpoint.get("os"),
            "last_seen": endpoint.get("last_seen"),
            "agent_active": _is_agent_active(endpoint.get("last_seen"))
        },
        "latest_scan": {
            "scan_time": latest_scan.get("scan_time"),
            "data": scan_data
        }
    }
