from fastapi import APIRouter
from datetime import datetime, timezone, timedelta
import uuid
import logging

from backend.db.mongo import agent_jobs_collection, endpoints_collection
from backend.services.endpoint_service import is_agent_active
from backend.routes.websockets import manager

router = APIRouter(prefix="/api/jobs", tags=["Job Scheduler"])
logger = logging.getLogger(__name__)


@router.get("/")
@router.get("")
def list_jobs():
    """
    Returns all jobs (pending and completed) from agent_jobs, newest first.
    """
    # Auto-cleanup expired jobs first
    now = datetime.now(timezone.utc)
    agent_jobs_collection().update_many(
        {"status": {"$in": ["pending", "disconnected"]}, "expires_at": {"$lt": now}},
        {"$set": {"status": "expired", "expired_at": now}}
    )

    try:
        cursor = agent_jobs_collection().find()
        jobs = list(cursor.sort("created_at", -1))
    except Exception:
        jobs = []
    out = []
    for j in jobs:
        eid = j.get("endpoint_id")
        if not j.get("job_id"):
            continue
        
        # Look up hostname and active status
        hostname = "—"
        agent_active = False
        if eid:
            ep = endpoints_collection().find_one({"endpoint_id": str(eid)})
            if ep:
                hostname = ep.get("hostname", "—")
                last_seen = ep.get("last_seen")
                if last_seen:
                    agent_active = is_agent_active(last_seen, threshold_seconds=60)
        out.append({
            "job_id": j.get("job_id"),
            "endpoint_id": str(eid or ""),
            "hostname": hostname,
            "agent_active": agent_active,
            "job_type": j.get("job_type", "RUN_SCAN"),
            "status": j.get("status", "pending"),
            "created_at": j.get("created_at"),
        })
    return {"jobs": out}


@router.post("/scan/all")
async def schedule_scan_all():
    """
    Schedule RUN_SCAN job for all registered endpoints.
    Run the agent first so it registers an endpoint; then this creates jobs for each.
    """
    # Auto-cleanup expired jobs first
    now = datetime.now(timezone.utc)
    agent_jobs_collection().update_many(
        {"status": {"$in": ["pending", "disconnected"]}, "expires_at": {"$lt": now}},
        {"$set": {"status": "expired", "expired_at": now}}
    )

    try:
        endpoints_cursor = list(endpoints_collection().find())
        deduped = {}
        for ep in endpoints_cursor:
            hostname = ep.get("hostname") or ep.get("endpoint_id")
            if hostname not in deduped:
                deduped[hostname] = ep
            else:
                existing_time = deduped[hostname].get("last_seen")
                new_time = ep.get("last_seen")
                if new_time and (not existing_time or new_time > existing_time):
                    deduped[hostname] = ep
        endpoints = list(deduped.values())
    except Exception:
        endpoints = []

    count = 0
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=2)
    
    for ep in endpoints:
        eid = ep.get("endpoint_id") or ep.get("_id")
        if eid is None:
            continue
            
        # Determine initial status based on agent activity
        status = "pending" if is_agent_active(ep.get("last_seen"), threshold_seconds=60) else "disconnected"
        # Check if there is already a pending job for this endpoint to avoid duplicates
        existing_job = agent_jobs_collection().find_one({
            "endpoint_id": str(eid),
            "status": {"$in": ["pending", "disconnected"]},
            "expires_at": {"$gt": now}
        })
        
        if existing_job:
            continue
            
        expires_at = now + timedelta(minutes=2) if status == "pending" else now + timedelta(seconds=6)

        try:
            job_id = str(uuid.uuid4())
            agent_jobs_collection().insert_one({
                "job_id": job_id,
                "endpoint_id": str(eid),
                "job_type": "RUN_SCAN",
                "status": status,
                "created_at": now,
                "expires_at": expires_at,
                "completed_at": None
            })
            count += 1
            logger.info(f"Created job {job_id} for endpoint {eid} with status '{status}'")
            
            # Broadcast the job_created event
            await manager.broadcast({
                "type": "job_created",
                "job_id": job_id,
                "endpoint_id": str(eid),
                "status": status
            })
            
        except Exception as e:
            logger.error(f"Failed to create job for endpoint {eid}: {str(e)}")
            continue

    return {
        "status": "scheduled",
        "jobs_created": count,
        "message": f"Scheduled {count} job(s) for {len(endpoints)} endpoint(s)." if count else "No endpoints registered. Run the agent first so it registers, then try Scan All again."
    }
