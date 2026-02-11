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
                # Calculate active status (threshold 2 mins)
                last_seen = ep.get("last_seen")
                if last_seen:
                    try:
                        if isinstance(last_seen, str):
                           last_seen = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                        if last_seen.tzinfo is None:
                            last_seen = last_seen.replace(tzinfo=timezone.utc)
                        
                        now = datetime.now(timezone.utc)
                        delta = now - last_seen
                        # Active if seen within last 2 minutes
                        if timedelta(0) < delta < timedelta(minutes=2):
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
    try:
        endpoints = list(endpoints_collection().find())
    except Exception:
        endpoints = []

    count = 0
    for ep in endpoints:
        eid = ep.get("endpoint_id") or ep.get("_id")
        if eid is None:
            continue
        try:
            agent_jobs_collection().insert_one({
                "job_id": str(uuid.uuid4()),
                "endpoint_id": str(eid),
                "job_type": "RUN_SCAN",
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
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
