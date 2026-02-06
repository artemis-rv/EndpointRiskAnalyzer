from fastapi import APIRouter
from datetime import datetime
import uuid

from backend.db.mongo import agent_jobs_collection, endpoints_collection

router = APIRouter(prefix="/api/jobs", tags=["Job Scheduler"])


@router.post("/scan/all")
def schedule_scan_all():
    """
    Schedule RUN_SCAN job for all registered endpoints.
    """
    endpoints = endpoints_collection().find()

    count = 0
    for ep in endpoints:
        agent_jobs_collection().insert_one({
            "job_id": str(uuid.uuid4()),
            "endpoint_id": ep["endpoint_id"],
            "job_type": "RUN_SCAN",
            "status": "pending",
            "created_at": datetime.utcnow(),
            "completed_at": None
        })
        count += 1

    return {
        "status": "scheduled",
        "jobs_created": count
    }
