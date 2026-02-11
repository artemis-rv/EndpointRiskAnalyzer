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

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone

from backend.db.mongo import (
    endpoints_collection,
    endpoint_scans_collection
)
from backend.limiter import limiter

router = APIRouter(prefix="/api/scans", tags=["Scans"])


@router.post("/")
@limiter.limit("5/minute")  # Max 5 scans per minute
def upload_scan(request: Request, scan: dict):
    """
    Receives raw scan data from an endpoint agent.

    Expected input:
    - JSON object produced by agent.py

    Behavior:
    - Creates or updates endpoint record
    - Stores scan data as-is
    """

    try:
        system_info = scan.get("system", {})
        hostname = scan.get("hostname") or system_info.get("hostname")
        os_name = scan.get("os") or system_info.get("os")
        agent_endpoint_id = scan.get("endpoint_id")  # Optional: agent's persistent UUID

        if not hostname or not os_name:
            raise HTTPException(
                status_code=400,
                detail="Scan must include hostname and os"
            )

        # Prefer agent's endpoint_id (UUID); else match by hostname for backward compatibility
        if agent_endpoint_id:
            endpoint = endpoints_collection().find_one({"endpoint_id": agent_endpoint_id})
            if not endpoint:
                endpoints_collection().insert_one({
                    "endpoint_id": agent_endpoint_id,
                    "hostname": hostname,
                    "os": os_name,
                    "last_seen": datetime.now(timezone.utc),
                })
                endpoint = endpoints_collection().find_one({"endpoint_id": agent_endpoint_id})
            else:
                endpoints_collection().update_one(
                    {"endpoint_id": agent_endpoint_id},
                    {"$set": {"last_seen": datetime.now(timezone.utc), "hostname": hostname, "os": os_name}}
                )
            # Store scan by string endpoint_id so we can query by UUID
            scan_record = {
                "endpoint_id": agent_endpoint_id,
                "scan_time": datetime.now(timezone.utc),
                "scan_data": scan
            }
        else:
            endpoint = endpoints_collection().find_one({"hostname": hostname})
            if not endpoint:
                endpoint = {
                    "hostname": hostname,
                    "os": os_name,
                    "last_seen": datetime.now(timezone.utc)
                }
                endpoint_id_oid = endpoints_collection().insert_one(endpoint).inserted_id
            else:
                endpoint_id_oid = endpoint["_id"]
                endpoints_collection().update_one(
                    {"_id": endpoint_id_oid},
                    {"$set": {"last_seen": datetime.now(timezone.utc)}}
                )
            scan_record = {
                "endpoint_id": endpoint_id_oid,
                "scan_time": datetime.now(timezone.utc),
                "scan_data": scan
            }

        endpoint_scans_collection().insert_one(scan_record)

        return {
            "status": "success",
            "message": "Scan stored successfully",
            "endpoint_id": agent_endpoint_id or str(endpoint.get("_id", ""))
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
