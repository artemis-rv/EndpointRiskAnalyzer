"""
posture.py

Read-only API routes for organization posture snapshots.
"""

from fastapi import APIRouter
from backend.db.mongo import org_posture_snapshots_collection

router = APIRouter(prefix="/api/posture", tags=["Posture"])


@router.get("/latest")
def get_latest_posture():
    """
    Returns the most recent organization posture snapshot.
    """

    snapshot = org_posture_snapshots_collection().find_one(
        {},
        sort=[("generated_at", -1)]
    )

    if not snapshot:
        return {
            "status": "empty",
            "message": "No posture snapshots available yet"
        }

    return {
        "snapshot_id": str(snapshot["_id"]),
        "generated_at": snapshot.get("generated_at"),
        "posture_data": snapshot.get("posture_data")
    }


@router.get("/")
def list_all_postures():
    """
    Returns metadata for all posture snapshots.
    """

    snapshots = []

    for snap in org_posture_snapshots_collection().find().sort("generated_at", -1):
        snapshots.append({
            "snapshot_id": str(snap["_id"]),
            "generated_at": snap.get("generated_at")
        })

    return {
        "total_snapshots": len(snapshots),
        "snapshots": snapshots
    }
