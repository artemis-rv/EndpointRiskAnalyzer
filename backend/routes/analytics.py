from fastapi import APIRouter
from backend.routes.posture import get_live_posture_summary

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/")
def get_analytics_data():
    """
    Transforms the live posture summary into graphing-ready structures
    for the frontend analytics dashboard (Recharts).
    """
    summary_data = get_live_posture_summary()
    
    if summary_data.get("status") == "empty":
        return {
            "status": "empty",
            "compliance_scores": [],
            "health_classification": [],
            "compliance_distribution": [],
            "endpoints_vs_critical": []
        }
        
    endpoints = summary_data.get("endpoint_summaries", [])
    
    # 1. Per-endpoint compliance score (Pie Chart)
    compliance_scores = [
        {"name": ep["hostname"], "value": ep["compliance_score"]}
        for ep in endpoints
    ]
    
    # 2. Endpoint health classification (Pie Chart)
    # We map compliance scores to Health Classifications
    # Hardened (>=85), Moderate (>=65), At Risk (>=45), Critical (<45)
    health_counts = {"Hardened": 0, "Moderate": 0, "At Risk": 0, "Critical": 0}
    for ep in endpoints:
        score = ep["compliance_score"]
        if score >= 85:
            health_counts["Hardened"] += 1
        elif score >= 65:
            health_counts["Moderate"] += 1
        elif score >= 45:
            health_counts["At Risk"] += 1
        else:
            health_counts["Critical"] += 1
            
    health_classification = [
        {"name": category, "value": count}
        for category, count in health_counts.items()
    ]
    
    # 3. Organizational compliance distribution (Bar Chart)
    # Grouping by 20% buckets
    dist_buckets = {"0-20%": 0, "21-40%": 0, "41-60%": 0, "61-80%": 0, "81-100%": 0}
    for ep in endpoints:
        score = ep["compliance_score"]
        if score <= 20: dist_buckets["0-20%"] += 1
        elif score <= 40: dist_buckets["21-40%"] += 1
        elif score <= 60: dist_buckets["41-60%"] += 1
        elif score <= 80: dist_buckets["61-80%"] += 1
        else: dist_buckets["81-100%"] += 1
        
    compliance_distribution = [
        {"range": bucket, "count": count}
        for bucket, count in dist_buckets.items()
    ]
    
    # 4. Total endpoints vs critical endpoints (Bar Chart)
    # Critical implies either risk_level == "High" or health == Critical
    total_endpoints = len(endpoints)
    critical_endpoints = sum(1 for ep in endpoints if ep["risk_level"].lower() == "high" or ep["compliance_score"] < 45)
    
    endpoints_vs_critical = [
        {"name": "Endpoints", "Total": total_endpoints, "Critical": critical_endpoints}
    ]
    
    return {
        "status": "success",
        "compliance_scores": compliance_scores,
        "health_classification": health_classification,
        "compliance_distribution": compliance_distribution,
        "endpoints_vs_critical": endpoints_vs_critical
    }
