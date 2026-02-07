from fastapi import APIRouter
from datetime import datetime
import uuid

from backend.db.mongo import agent_jobs_collection

router = APIRouter(prefix="/api/agent", tags=["Agent Jobs"])


@router.get("/jobs/{endpoint_id}")
def get_pending_job(endpoint_id: str):
    """
    Agent polls for pending jobs assigned to it.
    Returns ONE job at a time. endpoint_id must match what was stored (UUID or legacy id).
    """
    endpoint_id = (endpoint_id or "").strip()
    if not endpoint_id:
        return {"status": "no_job"}

    job = agent_jobs_collection().find_one({
        "endpoint_id": endpoint_id,
        "status": "pending"
    })
    if not job:
        # Also try matching as ObjectId for legacy endpoints
        from bson import ObjectId
        if ObjectId.is_valid(endpoint_id):
            job = agent_jobs_collection().find_one({
                "endpoint_id": ObjectId(endpoint_id),
                "status": "pending"
            })
    if not job:
        return {"status": "no_job"}

    return {
        "job_id": job.get("job_id"),
        "job_type": job.get("job_type", "RUN_SCAN")
    }




@router.post("/jobs/{job_id}/complete")
def mark_job_complete(job_id: str):
    """
    Agent marks job as completed.
    """

    agent_jobs_collection().update_one(
        {"job_id": job_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": datetime.utcnow()
            }
        }
    )

    return {"status": "completed"}


# job scanning
def create_scan_job(endpoint_id: str):
    agent_jobs_collection().insert_one({
        "job_id": str(uuid.uuid4()),
        "endpoint_id": endpoint_id,
        "job_type": "RUN_SCAN",
        "status": "pending",
        "created_at": datetime.utcnow(),
        "completed_at": None
    })
