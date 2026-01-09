#risk scoring

# risk_scoring.py

def calculate_risk_score(scan, features):
    """
    Calculate an explainable risk score (0–100) based on security posture.
    Returns score + breakdown.
    """

    score = 0
    breakdown = []

    # =========================
    # Protection Failures
    # =========================

    av_enabled = features.get("av_enabled")

    if av_enabled == 0:
        score += 40
        breakdown.append(("AV_DISABLED", 40))

    elif av_enabled == -1:
        score += 20
        breakdown.append(("AV_STATUS_UNKNOWN", 20))

    # =========================
    # Firewall Exposure
    # =========================

    if features.get("firewall_public_on") == 0:
        score += 30
        breakdown.append(("FIREWALL_PUBLIC_OFF", 30))

    if features.get("firewall_any_off") == 1:
        score += 15
        breakdown.append(("FIREWALL_PROFILE_OFF", 15))

    # =========================
    # Runtime Exposure
    # =========================

    if features.get("java_present") == 1:
        score += 10
        breakdown.append(("JAVA_PRESENT", 10))

    if features.get("python_present") == 1:
        score += 5
        breakdown.append(("PYTHON_PRESENT", 5))

    # =========================
    # Attack Surface
    # =========================

    if features.get("large_attack_surface") == 1:
        score += 10
        breakdown.append(("LARGE_ATTACK_SURFACE", 10))

    # =========================
    # Finalize
    # =========================

    score = min(score, 100)

    return {
        "risk_score": score,
        "risk_level": classify_risk(score),
        "breakdown": breakdown
    }


def classify_risk(score):
    """
    Convert numeric score to human-friendly category.
    """
    if score >= 70:
        return "HIGH"
    elif score >= 40:
        return "MEDIUM"
    elif score >= 10:
        return "LOW"
    else:
        return "MINIMAL"
