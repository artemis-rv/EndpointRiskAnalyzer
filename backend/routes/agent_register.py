from fastapi import APIRouter, Body
from datetime import datetime, timezone
from backend.db.mongo import endpoints_collection

router = APIRouter(prefix="/api/agent", tags=["Agent Registration"])


@router.post("/register")
def register_agent(payload: dict = Body(...)):
    endpoint_id = payload.get("endpoint_id")

    if not endpoint_id:
        return {"status": "error", "message": "Missing endpoint_id"}

    endpoints_collection().update_one(
        {"endpoint_id": endpoint_id},
        {
            "$set": {
                "endpoint_id": endpoint_id,
                "hostname": payload.get("hostname"),
                "os": payload.get("os"),
                "last_seen": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )

    return {"status": "registered"}

@router.post("/heartbeat/{endpoint_id}")
def agent_heartbeat(endpoint_id: str):
    """
    Agent liveness heartbeat.
    Updates last_seen timestamp.
    """
    endpoints_collection().update_one(
        {"endpoint_id": endpoint_id},
        {"$set": {"last_seen": datetime.now(timezone.utc)}}
    )

    return {"status": "alive"}
