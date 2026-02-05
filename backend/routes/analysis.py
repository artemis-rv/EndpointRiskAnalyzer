"""
analysis.py

API route to trigger systemic analysis.
"""

from fastapi import APIRouter, HTTPException

from backend.services.systemic_runner import run_and_store_systemic_analysis

router = APIRouter(prefix="/api/analyze", tags=["Analysis"])


@router.post("/")
def trigger_systemic_analysis():
    """
    Triggers organization-level systemic analysis.
    """

    try:
        snapshot_id = run_and_store_systemic_analysis()

        return {
            "status": "success",
            "message": "Systemic analysis completed",
            "posture_snapshot_id": snapshot_id
        }

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
