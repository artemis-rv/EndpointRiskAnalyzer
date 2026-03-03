from fastapi import APIRouter, Request, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import uuid

from backend.db.mongo import agent_jobs_collection
from backend.limiter import limiter
from backend.api_auth import verify_api_key

router = APIRouter(prefix="/api/agent", tags=["Agent Jobs"])


# primary job-polling endpoint (no trailing slash helps client form URLs cleanly)
@router.get("/jobs/{endpoint_id}")
@limiter.limit("3/minute")  # Max 3 requests per minute (prevents race condition with 30s polling)
def get_pending_job(request: Request, endpoint_id: str, auth_endpoint_id: str = Depends(verify_api_key)):
    """
    Agent polls for pending jobs assigned to it.
    Returns ONE non-expired job at a time. endpoint_id must match what was stored (UUID or legacy id).
    """
    endpoint_id = (endpoint_id or "").strip()
    if not endpoint_id:
        return {"status": "no_job"}

    if endpoint_id != auth_endpoint_id:
        raise HTTPException(status_code=403, detail="Forbidden: Token does not match endpoint_id")

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


# alias to accept a trailing slash without forcing a redirect
@router.get("/jobs/{endpoint_id}/", include_in_schema=False)
@limiter.limit("3/minute")
def get_pending_job_slash(request: Request, endpoint_id: str, auth_endpoint_id: str = Depends(verify_api_key)):
    # simply forward to main handler
    return get_pending_job(request, endpoint_id, auth_endpoint_id)




@router.post("/jobs/{job_id}/complete")
def mark_job_complete(job_id: str, auth_endpoint_id: str = Depends(verify_api_key)):
    """
    Agent marks job as completed.
    """
    # Verify the job belongs to the authenticated endpoint
    job = agent_jobs_collection().find_one({"job_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if str(job.get("endpoint_id")) != auth_endpoint_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot complete job for another endpoint")

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


@router.post("/jobs/{job_id}/complete/", include_in_schema=False)
def mark_job_complete_slash(job_id: str, auth_endpoint_id: str = Depends(verify_api_key)):
    return mark_job_complete(job_id, auth_endpoint_id)


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
    """Creates a new scan job with 2-minute expiration.
    
    Args:
        endpoint_id: The endpoint ID to create the job for
        
    Returns:
        dict: The created job document with job_id, endpoint_id, etc.
        
    Raises:
        Exception: If job creation fails
    """
    from datetime import timedelta
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=2)  # Standardized to 2 minutes (matches job_scheduler.py)
        
        job_doc = {
            "job_id": str(uuid.uuid4()),
            "endpoint_id": endpoint_id,
            "job_type": "RUN_SCAN",
            "status": "pending",
            "created_at": now,
            "expires_at": expires_at,
            "completed_at": None
        }
        
        result = agent_jobs_collection().insert_one(job_doc)
        
        # Verify insertion succeeded
        if not result.inserted_id:
            logger.error(f"Failed to create job for endpoint {endpoint_id}: No inserted_id returned")
            raise Exception("Job creation failed: No inserted_id returned")
        
        logger.info(f"Successfully created scan job {job_doc['job_id']} for endpoint {endpoint_id}")
        return job_doc
        
    except Exception as e:
        logger.error(f"Error creating scan job for endpoint {endpoint_id}: {str(e)}")
        raise Exception(f"Failed to create scan job: {str(e)}")
