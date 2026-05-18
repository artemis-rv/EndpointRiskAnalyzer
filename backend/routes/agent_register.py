from fastapi import APIRouter, Body, Depends, Header, HTTPException
from datetime import datetime, timezone
import secrets
import os
from backend.db.mongo import endpoints_collection
from backend.api_auth import verify_api_key
from backend.routes.websockets import manager

ENROLLMENT_TOKEN = os.getenv("ENROLLMENT_TOKEN", "")
router = APIRouter(prefix="/api/agent", tags=["Agent Registration"])


@router.post("/register")
async def register_agent(payload: dict = Body(...),x_enrollment_token: str=Header(None)):

    #1) checking if server enrollment token is configured
    if not ENROLLMENT_TOKEN:
        raise HTTPException(status_code=500, detail="Server enrollment token not configured")

    #2) verification of token (using compare_digest to prevent timing attacks)
    if not x_enrollment_token or not secrets.compare_digest(x_enrollment_token, ENROLLMENT_TOKEN):
        raise HTTPException(status_code=403, detail="Forbidden")

    endpoint_id=payload.get("endpoint_id")
    if not endpoint_id:
        return {"status":"error","message":"Missing endpoint_id"}

    #3) check if endpoint already exists
    existing_endpoint=endpoints_collection().find_one({"endpoint_id":endpoint_id})

    if existing_endpoint and "api_key" in existing_endpoint:
        raise HTTPException(status_code=409, detail="Endpoint already registered. Contact admin to reset")

    #generating key only for new endpoints
    api_key=secrets.token_hex(32)

    endpoints_collection().update_one(
        {
            "endpoint_id": endpoint_id
        },
        {
            "$set": {
                "endpoint_id": endpoint_id,
                "hostname":payload.get("hostname"),
                "os":payload.get("os"),
                "api_key":api_key,
                "last_seen":datetime.now(timezone.utc)
            }
        },
        upsert=True
    )

    # Websocket broadcast
    await manager.broadcast({
        "type": "agent_connected",
        "hostname": payload.get("hostname")
    })  

    return{"status":"success","api_key":api_key}  
        

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


# alias route accepting optional trailing slash
@router.post("/heartbeat/{endpoint_id}/", include_in_schema=False)
def agent_heartbeat_slash(endpoint_id: str, auth_endpoint_id: str = Depends(verify_api_key)):
    return agent_heartbeat(endpoint_id, auth_endpoint_id)
