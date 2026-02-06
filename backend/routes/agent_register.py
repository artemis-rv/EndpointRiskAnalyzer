from fastapi import APIRouter
from datetime import datetime
from backend.db.mongo import endpoints_collection

router = APIRouter(prefix="/api/agent", tags=["Agent Registration"])


@router.post("/register")
def register_agent(payload: dict):
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
                "last_seen": datetime.utcnow()
            }
        },
        upsert=True
    )

    return {"status": "registered"}
