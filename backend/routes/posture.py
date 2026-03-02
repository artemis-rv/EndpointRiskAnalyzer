"""
posture.py

Read-only API routes for organization posture snapshots.
"""

from fastapi import APIRouter
from backend.db.mongo import org_posture_snapshots_collection, endpoints_collection, endpoint_scans_collection
from backend.services.ml_service import predict_risk

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

    live_summary = get_live_posture_summary()

    if not snapshot:
        if live_summary.get("status") == "success":
            return {
                "status": "success",
                "message": "No posture snapshot available; returning live posture summary",
                "generated_at": live_summary.get("generated_at"),
                "live_summary": live_summary,
            }
        return {
            "status": "empty",
            "message": "No posture snapshots available yet",
        }

    return {
        "status": "success",
        "snapshot_id": str(snapshot["_id"]),
        "generated_at": snapshot.get("generated_at"),
        "posture_data": snapshot.get("posture_data"),
        "live_summary": live_summary,
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


def _safe_number(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


@router.get("/live-summary")
def get_live_posture_summary():
    """
    Returns real-time posture summary from latest scan of each endpoint.
    """
    endpoints = list(endpoints_collection().find({}))
    if not endpoints:
        return {
            "status": "empty",
            "message": "No endpoints available",
            "summary": {},
            "endpoint_count": 0,
            "endpoint_summaries": [],
            "key_observations": [],
        }

    endpoint_summaries = []
    compliance_scores = []
    high_risk = 0
    medium_risk = 0
    low_risk = 0
    critical_failures_total = 0
    high_failures_total = 0
    moderate_failures_total = 0
    non_compliant_control_counts = {}
    latest_scan_at = None

    for endpoint in endpoints:
        endpoint_id = endpoint.get("endpoint_id") or str(endpoint.get("_id"))
        scan = endpoint_scans_collection().find_one(
            {"endpoint_id": endpoint_id},
            sort=[("scan_time", -1)],
        )
        if not scan:
            continue

        scan_time = scan.get("scan_time")
        if scan_time and (latest_scan_at is None or scan_time > latest_scan_at):
            latest_scan_at = scan_time

        scan_data = scan.get("scan_data", {})
        hostname = (
            scan_data.get("hostname")
            or (scan_data.get("system") or {}).get("hostname")
            or endpoint.get("hostname")
            or "Unknown"
        )

        cis = scan_data.get("cis_compliance", {})
        score_obj = cis.get("compliance_score", {})
        score = _safe_number(score_obj.get("weighted_score", 0))
        compliance_scores.append(score)

        critical_failed = int(score_obj.get("critical_failed", 0) or 0)
        high_failed = int(score_obj.get("high_failed", 0) or 0)
        moderate_failed = int(score_obj.get("moderate_failed", 0) or 0)

        critical_failures_total += critical_failed
        high_failures_total += high_failed
        moderate_failures_total += moderate_failed

        for control in cis.get("controls", []):
            status = str(control.get("status", "")).lower()
            if status in {"non_compliant", "non-compliant"}:
                key = f"{control.get('control_id', 'N/A')} - {control.get('name', 'Unknown control')}"
                non_compliant_control_counts[key] = non_compliant_control_counts.get(key, 0) + 1

        risk = predict_risk(scan_data)
        risk_level = str(risk.get("risk", "unknown")).lower()
        if risk_level == "high":
            high_risk += 1
        elif risk_level == "medium":
            medium_risk += 1
        elif risk_level == "low":
            low_risk += 1

        endpoint_summaries.append(
            {
                "endpoint_id": endpoint_id,
                "hostname": hostname,
                "scan_time": scan_time.isoformat() if hasattr(scan_time, "isoformat") else scan_time,
                "compliance_score": round(score, 2),
                "critical_failures": critical_failed,
                "high_failures": high_failed,
                "moderate_failures": moderate_failed,
                "risk_level": risk.get("risk", "Unknown"),
                "anomaly_score": _safe_number(risk.get("anomaly_score", 0)),
            }
        )

    if not endpoint_summaries:
        return {
            "status": "empty",
            "message": "No scans found for endpoints",
            "summary": {},
            "endpoint_count": 0,
            "endpoint_summaries": [],
            "key_observations": [],
        }

    avg_compliance = sum(compliance_scores) / len(compliance_scores) if compliance_scores else 0.0
    if avg_compliance >= 85:
        compliance_band = "Hardened"
    elif avg_compliance >= 65:
        compliance_band = "Moderate Risk"
    elif avg_compliance >= 45:
        compliance_band = "At Risk"
    else:
        compliance_band = "Critical"

    top_controls = sorted(
        non_compliant_control_counts.items(),
        key=lambda kv: kv[1],
        reverse=True,
    )[:3]

    key_observations = []
    key_observations.append(
        f"Average compliance is {round(avg_compliance, 2)}% across {len(endpoint_summaries)} endpoint(s)."
    )
    if high_risk > 0:
        key_observations.append(f"{high_risk} endpoint(s) currently have HIGH risk.")
    if medium_risk > 0:
        key_observations.append(f"{medium_risk} endpoint(s) currently have MEDIUM risk.")
    if critical_failures_total > 0:
        key_observations.append(
            f"{critical_failures_total} critical CIS failures are active in latest scans."
        )
    for control, count in top_controls:
        key_observations.append(f"Control failure hotspot: {control} on {count} endpoint(s).")

    return {
        "status": "success",
        "generated_at": latest_scan_at.isoformat() if hasattr(latest_scan_at, "isoformat") else latest_scan_at,
        "summary": {
            "average_compliance_score": round(avg_compliance, 2),
            "compliance_band": compliance_band,
            "total_endpoints": len(endpoint_summaries),
            "risk_distribution": {
                "high": high_risk,
                "medium": medium_risk,
                "low": low_risk,
            },
            "total_critical_failures": critical_failures_total,
            "total_high_failures": high_failures_total,
            "total_moderate_failures": moderate_failures_total,
        },
        "endpoint_count": len(endpoint_summaries),
        "endpoint_summaries": endpoint_summaries,
        "key_observations": key_observations,
    }
