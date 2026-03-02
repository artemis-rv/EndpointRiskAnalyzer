from fastapi import APIRouter, Body, Depends, HTTPException
from datetime import datetime, timezone
import secrets
from backend.db.mongo import endpoints_collection
from backend.api_auth import verify_api_key

router = APIRouter(prefix="/api/agent", tags=["Agent Registration"])


@router.post("/register")
def register_agent(payload: dict = Body(...)):
    endpoint_id = payload.get("endpoint_id")

    if not endpoint_id:
        return {"status": "error", "message": "Missing endpoint_id"}

    # Check if endpoint already exists to return existing key
    existing_endpoint = endpoints_collection().find_one({"endpoint_id": endpoint_id})
    
    if existing_endpoint and "api_key" in existing_endpoint:
        api_key = existing_endpoint["api_key"]
    else:
        # Generate a new 64-character hex key
        api_key = secrets.token_hex(32)

    endpoints_collection().update_one(
        {"endpoint_id": endpoint_id},
        {
            "$set": {
                "endpoint_id": endpoint_id,
                "hostname": payload.get("hostname"),
                "os": payload.get("os"),
                "api_key": api_key,
                "last_seen": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )

    return {"status": "registered", "api_key": api_key}

@router.post("/heartbeat/{endpoint_id}")
def agent_heartbeat(endpoint_id: str, auth_endpoint_id: str = Depends(verify_api_key)):
    """
    Agent liveness heartbeat.
    Updates last_seen timestamp.
    """
    if endpoint_id != auth_endpoint_id:
        raise HTTPException(status_code=403, detail="Forbidden: Token does not match endpoint_id")

    endpoints_collection().update_one(
        {"endpoint_id": endpoint_id},
        {"$set": {"last_seen": datetime.now(timezone.utc)}}
    )

    return {"status": "alive"}
