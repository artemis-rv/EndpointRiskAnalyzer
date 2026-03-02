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

from fastapi import APIRouter, HTTPException, Request, Depends
from datetime import datetime, timezone
import logging

from backend.db.mongo import (
    endpoints_collection,
    endpoint_scans_collection
)
from backend.limiter import limiter
from backend.api_auth import verify_api_key

router = APIRouter(prefix="/api/scans", tags=["Scans"])
logger = logging.getLogger(__name__)


@router.post("/")
@limiter.limit("5/minute")  # Max 5 scans per minute
def upload_scan(request: Request, scan: dict, auth_endpoint_id: str = Depends(verify_api_key)):
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
        
        logger.info(f"Received scan from hostname='{hostname}', endpoint_id='{agent_endpoint_id}'")

        if not hostname or not os_name:
            logger.warning(f"Scan rejected: missing hostname or os. hostname={hostname}, os={os_name}")
            raise HTTPException(
                status_code=400,
                detail="Scan must include hostname and os"
            )

        if agent_endpoint_id and agent_endpoint_id != auth_endpoint_id:
            logger.warning(f"Scan rejected: token endpoint_id={auth_endpoint_id} does not match payload endpoint_id={agent_endpoint_id}")
            raise HTTPException(status_code=403, detail="Forbidden: Token does not match endpoint_id")


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

        result = endpoint_scans_collection().insert_one(scan_record)
        
        if result.inserted_id:
            logger.info(f"Successfully stored scan for endpoint {agent_endpoint_id or endpoint_id_oid}")
        else:
            logger.error(f"Failed to store scan for endpoint {agent_endpoint_id or endpoint_id_oid}: No inserted_id")
            raise Exception("Scan storage failed: No inserted_id returned")

        return {
            "status": "success",
            "message": "Scan stored successfully",
            "endpoint_id": agent_endpoint_id or str(endpoint.get("_id", ""))
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error storing scan from {hostname}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
