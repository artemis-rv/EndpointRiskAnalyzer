"""
interpretation.py

API route to trigger interpretation on a posture snapshot.
"""

from fastapi import APIRouter, HTTPException
from backend.services.interpretation_runner import run_and_store_interpretation

router = APIRouter(prefix="/api/interpret", tags=["Interpretation"])


@router.post("/{posture_snapshot_id}")
def trigger_interpretation(posture_snapshot_id: str):
    """
    Triggers interpretation for a given posture snapshot.
    """

    try:
        interpretation_id = run_and_store_interpretation(posture_snapshot_id)

        return {
            "status": "success",
            "message": "Interpretation completed",
            "interpretation_id": interpretation_id
        }

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
