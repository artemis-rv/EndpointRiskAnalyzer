"""
systemic_runner.py

Service layer to run systemic analysis using stored endpoint scans.
"""

from datetime import datetime, timezone

from backend.db.mongo import (
    endpoint_scans_collection,
    org_posture_snapshots_collection
)

from analysis.systemic_analysis import analyze_systemic_risk


def run_and_store_systemic_analysis():
    """
    Fetches all endpoint scans, runs systemic analysis,
    stores the resulting posture snapshot, and runs interpretation on it.
    """

    # Fetch all scans
    scans_cursor = endpoint_scans_collection().find()
    scans = []
    for scan in scans_cursor:
        scans.append(scan["scan_data"])

    if not scans:
        raise ValueError("No scans available for analysis")

    # Run existing analysis logic
    posture_result = analyze_systemic_risk(scans)

    # Store snapshot
    snapshot = {
        "generated_at": datetime.now(timezone.utc),
        "posture_data": posture_result
    }
    result = org_posture_snapshots_collection().insert_one(snapshot)
    snapshot_id = str(result.inserted_id)

    # Run interpretation on the new snapshot so Dashboard shows it
    try:
        from backend.services.interpretation_runner import run_and_store_interpretation
        run_and_store_interpretation(snapshot_id)
    except Exception:
        pass  # Don't fail systemic analysis if interpretation fails

    return snapshot_id
