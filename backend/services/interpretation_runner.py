"""
interpretation_runner.py

Service layer to run interpretation on a posture snapshot.
"""

from datetime import datetime, timezone
from bson import ObjectId

from backend.db.mongo import (
    org_posture_snapshots_collection,
    org_interpretations_collection
)

from analysis.interpretation import generate_interpretation


def run_and_store_interpretation(posture_snapshot_id: str):
    """
    Runs interpretation on a given posture snapshot
    and stores the interpretation result.
    """

    if not ObjectId.is_valid(posture_snapshot_id):
        raise ValueError("Invalid posture_snapshot_id")

    snapshot = org_posture_snapshots_collection().find_one(
        {"_id": ObjectId(posture_snapshot_id)}
    )

    if not snapshot:
        raise ValueError("Posture snapshot not found")

    posture_data = snapshot.get("posture_data")

    if not posture_data:
        raise ValueError("Invalid posture snapshot data")

    # Run interpretation logic
    interpretation_result = generate_interpretation(posture_data)

    interpretation_record = {
        "posture_snapshot_id": snapshot["_id"],
        "generated_at": datetime.now(timezone.utc),
        "interpretation": interpretation_result
    }

    result = org_interpretations_collection().insert_one(interpretation_record)

    return str(result.inserted_id)
