"""
scans_read.py

Read-only API routes for retrieving scans for a given endpoint.

Responsibilities:
- Fetch scans associated with an endpoint
- Return raw scan data for inspection

This module does NOT:
- Modify scans
- Trigger analysis
- Perform interpretation
"""

from fastapi import APIRouter, HTTPException
from bson import ObjectId

from backend.db.mongo import endpoint_scans_collection

router = APIRouter(prefix="/api/scans", tags=["Scans (Read)"])


@router.get("/{endpoint_id}")
def get_scans_for_endpoint(endpoint_id: str):
    """
    Returns all scans for a given endpoint ID.
    """

    # Validate ObjectId
    if not ObjectId.is_valid(endpoint_id):
        raise HTTPException(status_code=400, detail="Invalid endpoint_id")

    oid = ObjectId(endpoint_id)

    scans_cursor = endpoint_scans_collection().find(
        {"endpoint_id": oid}
    ).sort("scan_time", -1)

    scans = []

    for scan in scans_cursor:
        scans.append({
            "scan_id": str(scan["_id"]),
            "scan_time": scan.get("scan_time"),
            "scan_data": scan.get("scan_data")
        })

    return {
        "endpoint_id": endpoint_id,
        "total_scans": len(scans),
        "scans": scans
    }
