from fastapi import APIRouter
from datetime import datetime, timezone, timedelta
import uuid

from backend.db.mongo import agent_jobs_collection, endpoints_collection

router = APIRouter(prefix="/api/jobs", tags=["Job Scheduler"])


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
                # Calculate active status (threshold 45 seconds for stricter "active" check)
                last_seen = ep.get("last_seen")
                if last_seen:
                    try:
                        if isinstance(last_seen, str):
                           last_seen = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                        if last_seen.tzinfo is None:
                            last_seen = last_seen.replace(tzinfo=timezone.utc)
                        
                        now = datetime.now(timezone.utc)
                        delta = now - last_seen
                        # Active if seen within last 45 seconds (1.5x heartbeat)
                        if timedelta(0) < delta < timedelta(seconds=45):
                            agent_active = True
                    except Exception:
                        pass

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
def schedule_scan_all():
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
        endpoints = list(endpoints_collection().find())
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
        status = "pending"
        try:
            last_seen = ep.get("last_seen")
            if last_seen:
                if isinstance(last_seen, str):
                    last_seen = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                if last_seen.tzinfo is None:
                    last_seen = last_seen.replace(tzinfo=timezone.utc)
                
                delta = now - last_seen
                # Active only if seen within last 45 seconds (strict)
                if not (timedelta(0) < delta < timedelta(seconds=45)):
                    status = "disconnected"
            else:
                status = "disconnected"
        except Exception:
            status = "disconnected"

        # Check if there is already a pending job for this endpoint to avoid duplicates
        # We only check for PENDING jobs. If there is a "disconnected" job, we might want to schedule a new one?
        # Actually, let's just avoid duplicates for any non-completed, non-expired job to keep it clean.
        existing_job = agent_jobs_collection().find_one({
            "endpoint_id": str(eid),
            "status": {"$in": ["pending", "disconnected"]},
            "expires_at": {"$gt": now}
        })
        
        if existing_job:
            continue
            
        try:
            agent_jobs_collection().insert_one({
                "job_id": str(uuid.uuid4()),
                "endpoint_id": str(eid),
                "job_type": "RUN_SCAN",
                "status": status,
                "created_at": now,
                "expires_at": expires_at,
                "completed_at": None
            })
            count += 1
        except Exception:
            continue

    return {
        "status": "scheduled",
        "jobs_created": count,
        "message": f"Scheduled {count} job(s) for {len(endpoints)} endpoint(s)." if count else "No endpoints registered. Run the agent first so it registers, then try Scan All again."
    }
