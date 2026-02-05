"""
scans.py

API routes for receiving endpoint scan data from agents.

Responsibilities:
- Accept raw scan JSON
- Associate scan with endpoint
- Store scan in MongoDB

This module does NOT:
- Perform analysis
- Perform interpretation
- Modify scan contents
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from backend.db.mongo import (
    endpoints_collection,
    endpoint_scans_collection
)

router = APIRouter(prefix="/api/scans", tags=["Scans"])


@router.post("/")
def upload_scan(scan: dict):
    """
    Receives raw scan data from an endpoint agent.

    Expected input:
    - JSON object produced by agent.py

    Behavior:
    - Creates or updates endpoint record
    - Stores scan data as-is
    """

    try:
        # Basic identity extraction
        hostname = scan.get("hostname")
        os_name = scan.get("os")

        if not hostname or not os_name:
            raise HTTPException(
                status_code=400,
                detail="Scan must include hostname and os"
            )

        # Check if endpoint already exists
        endpoint = endpoints_collection().find_one({"hostname": hostname})

        if not endpoint:
            # Create new endpoint
            endpoint = {
                "hostname": hostname,
                "os": os_name,
                "last_seen": datetime.now(timezone.utc)
            }
            endpoint_id = endpoints_collection().insert_one(endpoint).inserted_id
        else:
            # Update last_seen
            endpoint_id = endpoint["_id"]
            endpoints_collection().update_one(
                {"_id": endpoint_id},
                {"$set": {"last_seen": datetime.now(timezone.utc)}}
            )

        # Store raw scan
        scan_record = {
            "endpoint_id": endpoint_id,
            "scan_time": datetime.now(timezone.utc),
            "scan_data": scan
        }

        endpoint_scans_collection().insert_one(scan_record)

        return {
            "status": "success",
            "message": "Scan stored successfully",
            "endpoint_id": str(endpoint_id)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
