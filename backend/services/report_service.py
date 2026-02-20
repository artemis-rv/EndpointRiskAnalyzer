"""
report_service.py
-----------------
Generates structured Organizational Security Posture Report.

This file:
- Aggregates endpoint scans
- Computes organization-level CIS statistics
- Integrates AI deviation data
- Produces structured report JSON
- Adds metadata (version, timestamp, integrity hash)

This service does NOT generate PDF.
It returns structured JSON only.
"""

from datetime import datetime
import hashlib
from bson import ObjectId

from backend.db.mongo import endpoints_collection, endpoint_scans_collection


REPORT_VERSION = "1.0.0"

def generate_organization_report():
    """
    Main function to generate full structured report.
    """

    # 1️⃣ Fetch all endpoints
    endpoints = list(endpoints_collection().find({}))

    total_endpoints = len(endpoints)

    if total_endpoints == 0:
        return {"error": "No endpoints available for report generation"}


    # 2️⃣ Fetch latest scan per endpoint
    latest_scans = []

    for ep in endpoints:
        # Use the UUID endpoint_id if available, otherwise fallback to _id
        eid = ep.get("endpoint_id") or str(ep["_id"])
        
        latest = endpoint_scans_collection().find_one(
            {"endpoint_id": eid},
            sort=[("scan_time", -1)]  # changed from created_at to scan_time
        )
        if latest:
            latest_scans.append(latest)

    # Safety check
    if not latest_scans:
        return {"error": "No scans found for endpoints"}

    

     # 3️⃣ Aggregate compliance metrics
    compliance_scores = []
    critical_failures = 0
    moderate_failures = 0
    high_failures = 0

    endpoint_table = []

    for scan in latest_scans:
        # CIS data is nested: scan -> scan_data -> cis_compliance -> compliance_score
        scan_data = scan.get("scan_data", {})
        cis_data = scan_data.get("cis_compliance", {})
        compliance_score_obj = cis_data.get("compliance_score", {})

        score = compliance_score_obj.get("weighted_score", 0)
        compliance_scores.append(score)

        critical_failures += compliance_score_obj.get("critical_failed", 0)
        high_failures += compliance_score_obj.get("high_failed", 0)
        moderate_failures += compliance_score_obj.get("moderate_failed", 0)

        # ML assessment for deviation
        ml_assessment = scan_data.get("ml_assessment", {}) or scan.get("ml_assessment", {})

        endpoint_table.append({
            "endpoint_id": scan.get("endpoint_id"),
            "hostname": scan.get("hostname") or scan_data.get("hostname", "Unknown"),
            "compliance_score": score,
            "critical_failures": compliance_score_obj.get("critical_failed", 0),
            "deviation_level": ml_assessment.get("deviation_category", "Unknown")
        })


    # 4️⃣ Compute overall compliance
    avg_compliance = sum(compliance_scores) / len(compliance_scores)

    # Determine band
    if avg_compliance >= 85:
        compliance_band = "Hardened"
    elif avg_compliance >= 65:
        compliance_band = "Moderate Risk"
    elif avg_compliance >= 45:
        compliance_band = "At Risk"
    else:
        compliance_band = "Critical"

     # 5️⃣ Executive Summary
    executive_summary = {
        "overall_compliance_score": round(avg_compliance, 2),
        "compliance_band": compliance_band,
        "total_endpoints": total_endpoints,
        "total_critical_failures": critical_failures,
        "total_high_failures": high_failures,
        "total_moderate_failures": moderate_failures
    }

    # 6️⃣ Organizational Snapshot
    org_snapshot = {
        "average_score": round(avg_compliance, 2),
        "risk_distribution": {
            "critical": len([s for s in compliance_scores if s < 45]),
            "moderate": len([s for s in compliance_scores if 45 <= s < 65]),
            "secure": len([s for s in compliance_scores if s >= 65])
        }
    }

    # 7️⃣ Priority Actions (Top 3 logic placeholder)
    # NOTE: Replace with your AI prioritization engine later
    priority_actions = [
        "Enable firewall on all private/public profiles.",
        "Increase minimum password length to ≥14.",
        "Disable SMBv1 protocol."
    ]

    # 8️⃣ Deviation Analysis (AI layer)
    deviation_analysis = {
        "high_deviation_endpoints": [
            e for e in endpoint_table if e["deviation_level"] == "High Deviation"
        ]
    }

    # 9️⃣ Exposure Summary (simple aggregation example)
    exposure_summary = {
        "total_critical_failures": critical_failures,
        "note": "Exposure risk derived from CIS critical control failures."
    }

    # 🔟 Assemble full report body
    report_body = {
        "executive_summary": executive_summary,
        "org_snapshot": org_snapshot,
        "priority_actions": priority_actions,
        "endpoint_table": endpoint_table,
        "deviation_analysis": deviation_analysis,
        "exposure_summary": exposure_summary
    }

    # 1️⃣1️⃣ Add metadata
    report_metadata = {
        "report_version": REPORT_VERSION,
        "generated_at": datetime.utcnow().isoformat(),
    }

    # Integrity hash (basic SHA256 of body)
    hash_input = str(report_body).encode()
    integrity_hash = hashlib.sha256(hash_input).hexdigest()

    report_metadata["integrity_hash"] = integrity_hash

    return {
        "metadata": report_metadata,
        "report": report_body
    }