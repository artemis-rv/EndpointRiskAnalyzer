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
    Returns active and recent jobs from agent_jobs, newest first.
    - Marks stale pending/disconnected jobs as 'expired'.
    - Permanently deletes completed/expired jobs older than 2 hours.
    - Only returns jobs created within the last 24 hours that are still relevant.
    """
    now = datetime.now(timezone.utc)
    cutoff_expire = now  # anything past expires_at becomes expired
    cutoff_delete = now - timedelta(hours=2)   # completed/expired older than 2h → delete
    recent_window = now - timedelta(hours=24)  # only show jobs from last 24h

    # 1. Flip stale pending/disconnected → expired
    agent_jobs_collection().update_many(
        {"status": {"$in": ["pending", "disconnected"]}, "expires_at": {"$lt": cutoff_expire}},
        {"$set": {"status": "expired", "expired_at": now}}
    )

    # 2. Permanently delete old completed/expired jobs (keep DB clean)
    agent_jobs_collection().delete_many(
        {
            "status": {"$in": ["completed", "expired"]},
            "created_at": {"$lt": cutoff_delete}
        }
    )

    # 3. Fetch only recent jobs (last 24 hours)
    try:
        cursor = agent_jobs_collection().find({"created_at": {"$gte": recent_window}})
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
    now = datetime.now(timezone.utc)
    cutoff_delete = now - timedelta(hours=2)

    # 1. Flip stale pending/disconnected → expired
    agent_jobs_collection().update_many(
        {"status": {"$in": ["pending", "disconnected"]}, "expires_at": {"$lt": now}},
        {"$set": {"status": "expired", "expired_at": now}}
    )

    # 2. Purge old completed/expired records so DB stays clean
    agent_jobs_collection().delete_many(
        {
            "status": {"$in": ["completed", "expired"]},
            "created_at": {"$lt": cutoff_delete}
        }
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

    for ep in endpoints:
        eid = ep.get("endpoint_id") or ep.get("_id")
        if eid is None:
            continue

        # Determine initial status based on agent activity
        agent_online = is_agent_active(ep.get("last_seen"), threshold_seconds=60)
        status = "pending" if agent_online else "disconnected"

        # Skip if a live non-expired job already exists for this endpoint
        existing_job = agent_jobs_collection().find_one({
            "endpoint_id": str(eid),
            "status": {"$in": ["pending", "disconnected"]},
            "expires_at": {"$gt": now}
        })

        if existing_job:
            continue

        # Online agents: expire after 2 min (agent picks up quickly).
        # Offline agents: expire after 30 min so the admin can see the
        # PENDING (OFFLINE) state for a meaningful window before it
        # transitions to expired and gets cleaned up.
        expires_at = now + timedelta(minutes=2) if agent_online else now + timedelta(minutes=30)

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
        "message": (
            f"Scheduled {count} job(s) for {len(endpoints)} endpoint(s)."
            if count
            else "No endpoints registered. Run the agent first so it registers, then try Scan All again."
        )
    }
