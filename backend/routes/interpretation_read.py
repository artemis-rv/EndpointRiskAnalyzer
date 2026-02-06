"""
interpretation_read.py

Read-only API routes for interpretation results.
"""

from fastapi import APIRouter
from backend.db.mongo import org_interpretations_collection

router = APIRouter(prefix="/api/interpret", tags=["Interpretation (Read)"])


@router.get("/latest")
def get_latest_interpretation():
    """
    Returns the most recent interpretation result.
    """

    interpretation = org_interpretations_collection().find_one(
        {},
        sort=[("generated_at", -1)]
    )

    if not interpretation:
        return {
            "status": "empty",
            "message": "No interpretation available yet"
        }

    return {
        "interpretation_id": str(interpretation["_id"]),
        "generated_at": interpretation.get("generated_at"),
        "interpretation": interpretation.get("interpretation")
    }
