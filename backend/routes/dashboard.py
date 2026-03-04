from fastapi import APIRouter
from backend.db.mongo import org_posture_snapshots_collection
from backend.routes.posture import get_live_posture_summary
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
logger = logging.getLogger(__name__)

# Basic in-memory cache as an alternative to DB, but requirement says "in memory or database".
# We'll use a simple in-memory cache to avoid repeated DB writes for every single scan, 
# but storing it in org_posture_snapshots is also okay. Let's do in-memory here for ultra-fast reads.
_dashboard_cache = {
    "summary": None,
    "last_updated": None
}

def update_dashboard_cache():
    """
    Recomputes the live posture summary and caches it.
    This should be called ONLY when scans complete or agents change state significantly,
    not repeatedly by the frontend.
    """
    try:
        logger.info("Recomputing and caching dashboard summary...")
        summary = get_live_posture_summary()
        _dashboard_cache["summary"] = summary
        _dashboard_cache["last_updated"] = datetime.now(timezone.utc).isoformat()
        
        # Also store it in DB (snapshot) periodically or every time
        org_posture_snapshots_collection().insert_one({
            "generated_at": datetime.now(timezone.utc),
            "posture_data": summary
        })
        logger.info("Dashboard summary cached successfully.")
    except Exception as e:
        logger.error(f"Failed to update dashboard cache: {e}")

@router.get("/summary")
def get_dashboard_summary():
    """
    Returns the cached dashboard summary to optimize traffic.
    Avoids recomputing posture on every polling request.
    """
    if not _dashboard_cache["summary"]:
        # First time, or cache was cleared. Compute it synchronously once.
        update_dashboard_cache()
    
    return {
        "status": "success",
        "cached_at": _dashboard_cache["last_updated"],
        "data": _dashboard_cache["summary"]
    }
