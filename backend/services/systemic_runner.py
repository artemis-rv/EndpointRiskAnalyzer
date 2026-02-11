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


from backend.services.ml_service import predict_risk

def run_and_store_systemic_analysis():
    """
    Fetches all endpoint scans (deduplicated by latest), runs systemic analysis,
    stores the resulting posture snapshot with ML insights, and runs interpretation on it.
    """

    # Fetch all scans sorted by time descending to get latest first
    scans_cursor = endpoint_scans_collection().find().sort("scan_time", -1)
    
    unique_scans_map = {}
    ml_stats = {
        "high_risk_count": 0,
        "medium_risk_count": 0,
        "low_risk_count": 0,
        "anomalies_detected": 0
    }
    
    scans_for_analysis = []

    for scan in scans_cursor:
        sdata = scan.get("scan_data", {})
        # Hostname determination logic matching systemic_analysis.py
        hostname = sdata.get("hostname") or sdata.get("system", {}).get("hostname")
        
        if not hostname:
            continue
            
        hostname = str(hostname).strip().lower()

        if hostname not in unique_scans_map:
            unique_scans_map[hostname] = sdata
            scans_for_analysis.append(sdata)
            
            # ML Risk Calculation
            try:
                risk_res = predict_risk(sdata)
                r_level = risk_res.get("risk", "Unknown")
                is_anomaly = risk_res.get("is_anomaly", False)
                
                if r_level == "High":
                    ml_stats["high_risk_count"] += 1
                elif r_level == "Medium":
                    ml_stats["medium_risk_count"] += 1
                elif r_level == "Low":
                    ml_stats["low_risk_count"] += 1
                    
                if is_anomaly:
                    ml_stats["anomalies_detected"] += 1
            except Exception:
                pass # Continue if ML fails for one host

    if not scans_for_analysis:
        raise ValueError("No scans available for analysis")

    # Run existing analysis logic
    posture_result = analyze_systemic_risk(scans_for_analysis)
    
    # Inject ML Stats
    posture_result["ml_risk_overview"] = ml_stats

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
