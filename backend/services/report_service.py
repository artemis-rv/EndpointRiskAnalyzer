"""
report_service.py
-----------------
Generates structured Organizational Security Posture Report from latest scans.
"""

from datetime import datetime
import hashlib

from backend.db.mongo import endpoints_collection, endpoint_scans_collection
from backend.services.ml_service import predict_risk


REPORT_VERSION = "1.1.0"


def _safe_number(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _normalize_hostname(scan_data: dict, fallback: str = "Unknown") -> str:
    return (
        scan_data.get("hostname")
        or (scan_data.get("system") or {}).get("hostname")
        or fallback
    )


def _extract_non_compliant_controls(cis_controls):
    controls = []
    for control in cis_controls or []:
        status = str(control.get("status", "")).strip().lower()
        if status in {"non_compliant", "non-compliant"}:
            controls.append(
                {
                    "control_id": control.get("control_id", "N/A"),
                    "name": control.get("name", "Unknown control"),
                    "severity_weight": int(control.get("severity_weight", 0) or 0),
                    "reason": control.get("reason") or control.get("details") or "No reason provided",
                }
            )
    controls.sort(key=lambda c: c["severity_weight"], reverse=True)
    return controls


def _latest_scan_for_endpoint(endpoint_id: str):
    return endpoint_scans_collection().find_one(
        {"endpoint_id": endpoint_id},
        sort=[("scan_time", -1)],
    )


def _build_priority_actions(control_failure_count: dict):
    top_failed_controls = sorted(
        control_failure_count.items(),
        key=lambda item: item[1],
        reverse=True,
    )[:5]
    if not top_failed_controls:
        return ["No critical remediation action required from latest scans."]
    return [
        f"Remediate control {control_name} across {count} endpoint(s)."
        for control_name, count in top_failed_controls
    ]


def _compliance_band(avg_compliance: float) -> str:
    if avg_compliance >= 85:
        return "Hardened"
    if avg_compliance >= 65:
        return "Moderate Risk"
    if avg_compliance >= 45:
        return "At Risk"
    return "Critical"


def generate_organization_report():
    endpoints = list(endpoints_collection().find({}))
    total_endpoints = len(endpoints)

    if total_endpoints == 0:
        return {"error": "No endpoints available for report generation"}

    latest_scans = []
    for endpoint in endpoints:
        endpoint_id = endpoint.get("endpoint_id") or str(endpoint["_id"])
        latest = _latest_scan_for_endpoint(endpoint_id)
        if latest:
            latest_scans.append(latest)

    if not latest_scans:
        return {"error": "No scans found for endpoints"}

    compliance_scores = []
    critical_failures = 0
    high_failures = 0
    moderate_failures = 0
    control_failure_count = {}
    endpoint_table = []
    latest_scan_at = None

    for scan in latest_scans:
        scan_data = scan.get("scan_data", {})
        cis_data = scan_data.get("cis_compliance", {})
        compliance_obj = cis_data.get("compliance_score", {})
        scan_time = scan.get("scan_time")

        weighted_score = _safe_number(compliance_obj.get("weighted_score", 0))
        compliance_scores.append(weighted_score)

        critical = int(compliance_obj.get("critical_failed", 0) or 0)
        high = int(compliance_obj.get("high_failed", 0) or 0)
        moderate = int(compliance_obj.get("moderate_failed", 0) or 0)
        critical_failures += critical
        high_failures += high
        moderate_failures += moderate

        if scan_time and (latest_scan_at is None or scan_time > latest_scan_at):
            latest_scan_at = scan_time

        risk = predict_risk(scan_data)
        non_compliant_controls = _extract_non_compliant_controls(cis_data.get("controls", []))
        for control in non_compliant_controls:
            key = f"{control['control_id']} - {control['name']}"
            control_failure_count[key] = control_failure_count.get(key, 0) + 1

        endpoint_table.append(
            {
                "endpoint_id": str(scan.get("endpoint_id")),
                "hostname": _normalize_hostname(scan_data),
                "os": scan_data.get("os") or (scan_data.get("system") or {}).get("os") or "Unknown",
                "scan_time": scan_time.isoformat() if hasattr(scan_time, "isoformat") else scan_time,
                "compliance_score": round(weighted_score, 2),
                "critical_failures": critical,
                "high_failures": high,
                "moderate_failures": moderate,
                "deviation_level": risk.get("risk", "Unknown"),
                "anomaly_score": round(_safe_number(risk.get("anomaly_score", 0)), 4),
                "top_control_failures": non_compliant_controls[:3],
            }
        )

    avg_compliance = sum(compliance_scores) / len(compliance_scores)
    compliance_band = _compliance_band(avg_compliance)

    executive_summary = {
        "overall_compliance_score": round(avg_compliance, 2),
        "compliance_band": compliance_band,
        "total_endpoints": total_endpoints,
        "total_critical_failures": critical_failures,
        "total_high_failures": high_failures,
        "total_moderate_failures": moderate_failures,
        "latest_scan_at": latest_scan_at.isoformat() if hasattr(latest_scan_at, "isoformat") else latest_scan_at,
    }

    org_snapshot = {
        "average_score": round(avg_compliance, 2),
        "total_scans_evaluated": len(latest_scans),
        "risk_distribution": {
            "critical": len([s for s in compliance_scores if s < 45]),
            "moderate": len([s for s in compliance_scores if 45 <= s < 65]),
            "secure": len([s for s in compliance_scores if s >= 65]),
        },
    }

    deviation_analysis = {
        "high_deviation_endpoints": [
            e for e in endpoint_table if str(e.get("deviation_level", "")).lower() == "high"
        ],
        "medium_deviation_endpoints": [
            e for e in endpoint_table if str(e.get("deviation_level", "")).lower() == "medium"
        ],
    }

    report_body = {
        "executive_summary": executive_summary,
        "org_snapshot": org_snapshot,
        "priority_actions": _build_priority_actions(control_failure_count),
        "endpoint_table": endpoint_table,
        "deviation_analysis": deviation_analysis,
        "exposure_summary": {
            "total_critical_failures": critical_failures,
            "note": "Exposure risk derived from latest scan CIS control outcomes.",
        },
    }

    report_metadata = {
        "report_version": REPORT_VERSION,
        "generated_at": datetime.utcnow().isoformat(),
    }
    report_metadata["integrity_hash"] = hashlib.sha256(str(report_body).encode()).hexdigest()

    return {
        "metadata": report_metadata,
        "report": report_body,
    }
