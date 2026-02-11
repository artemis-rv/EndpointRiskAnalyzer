from fastapi import APIRouter, Request
from datetime import datetime, timezone, timedelta
import uuid

from backend.db.mongo import agent_jobs_collection
from backend.limiter import limiter

router = APIRouter(prefix="/api/agent", tags=["Agent Jobs"])


@router.get("/jobs/{endpoint_id}")
@limiter.limit("1/30seconds")  # Max 1 request per 30 seconds
def get_pending_job(request: Request, endpoint_id: str):
    """
    Agent polls for pending jobs assigned to it.
    Returns ONE non-expired job at a time. endpoint_id must match what was stored (UUID or legacy id).
    """
    endpoint_id = (endpoint_id or "").strip()
    if not endpoint_id:
        return {"status": "no_job"}

    now = datetime.now(timezone.utc)

    # Find non-expired pending job
    job = agent_jobs_collection().find_one({
        "endpoint_id": endpoint_id,
        "status": "pending",
        "expires_at": {"$gt": now}  # Only non-expired jobs
    })
    
    if not job:
        # Also try matching as ObjectId for legacy endpoints
        from bson import ObjectId
        if ObjectId.is_valid(endpoint_id):
            job = agent_jobs_collection().find_one({
                "endpoint_id": ObjectId(endpoint_id),
                "status": "pending",
                "expires_at": {"$gt": now}
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
                "completed_at": datetime.now(timezone.utc)
            }
        }
    )

    return {"status": "completed"}


@router.post("/jobs/cleanup-expired")
def cleanup_expired_jobs():
    """
    Mark expired pending jobs as 'expired'.
    This can be called periodically or manually to clean up stale jobs.
    """
    now = datetime.now(timezone.utc)
    
    result = agent_jobs_collection().update_many(
        {
            "status": "pending",
            "expires_at": {"$lt": now}
        },
        {
            "$set": {
                "status": "expired",
                "expired_at": now
            }
        }
    )
    
    return {
        "status": "ok",
        "expired_count": result.modified_count
    }


# job scanning
def create_scan_job(endpoint_id: str):
    """Creates a new scan job with 5-minute expiration."""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=5)
    
    agent_jobs_collection().insert_one({
        "job_id": str(uuid.uuid4()),
        "endpoint_id": endpoint_id,
        "job_type": "RUN_SCAN",
        "status": "pending",
        "created_at": now,
        "expires_at": expires_at,
        "completed_at": None
    })
