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

from backend.db.mongo import endpoint_scans_collection
from backend.services.endpoint_service import upsert_endpoint
from backend.limiter import limiter
from backend.api_auth import verify_api_key
from backend.routes.dashboard import update_dashboard_cache
from backend.routes.websockets import manager
from backend.services.ml_service import mark_model_stale

router = APIRouter(prefix="/api/scans", tags=["Scans"])
logger = logging.getLogger(__name__)


@router.post("/")
@limiter.limit("5/minute")  # Max 5 scans per minute
async def upload_scan(request: Request, scan: dict, auth_endpoint_id: str = Depends(verify_api_key)):
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

        endpoint_id = upsert_endpoint(hostname, os_name, agent_endpoint_id)
        
        scan_record = {
            "endpoint_id": endpoint_id,
            "scan_time": datetime.now(timezone.utc),
            "scan_data": scan
        }
        result = endpoint_scans_collection().insert_one(scan_record)
        
        if result.inserted_id:
            logger.info(f"Successfully stored scan for endpoint {endpoint_id}")
            # Trigger Cache Update & Broadcasting
            mark_model_stale()
            update_dashboard_cache()
            await manager.broadcast({"type": "scan_completed", "endpoint_id": str(endpoint_id), "hostname": hostname})
            await manager.broadcast({"type": "posture_updated"})
        else:
            logger.error(f"Failed to store scan for endpoint {endpoint_id}: No inserted_id")
            raise Exception("Scan storage failed: No inserted_id returned")

        return {
            "status": "success",
            "endpoint_id": str(endpoint_id)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error storing scan from {hostname}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
