from fastapi import APIRouter
from datetime import datetime
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
        if not j.get("job_id"):
            continue
        out.append({
            "job_id": j.get("job_id"),
            "endpoint_id": str(j.get("endpoint_id", "")),
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
                "created_at": datetime.utcnow(),
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
