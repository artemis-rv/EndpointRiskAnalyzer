
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from backend.db.mongo import endpoint_scans_collection
import pickle
import os

# Global models (in-memory for MVP)
MODEL_IF = None
MODEL_KM = None
# Path to save/load models if needed, but for now in-memory is fine
# or we can save to disk to persist across reloads.
MODEL_PATH = "ml_models.pkl"

FEATURE_COLUMNS = [
    'listening_ports_count', 
    'risky_ports_count', 
    'remote_registry_enabled', 
    'winrm_enabled',
    'rdp_enabled',
    'av_enabled',
    'firewall_any_off',
    'software_count',
    'large_attack_surface',
    # CIS Compliance Features
    'cis_weighted_score',
    'cis_critical_failures',
    'cis_total_failures'
]

def extract_features(scan_data):
    features = {}

    # ===== NETWORK FEATURES =====
    features['listening_ports_count'] = scan_data.get(
        'listening_ports_count', 0
    )

    risky_ports = scan_data.get('risky_listening_ports', [])
    features['risky_ports_count'] = len(risky_ports) if isinstance(risky_ports, list) else 0

    # ===== EXPOSURE POSTURE =====
    exposure = scan_data.get('exposure_posture', {})

    features['remote_registry_enabled'] = 1 if exposure.get('remote_registry_enabled') else 0
    features['winrm_enabled'] = 1 if exposure.get('winrm_enabled') else 0
    features['rdp_enabled'] = 1 if exposure.get('rdp_enabled') else 0

    # ===== SECURITY FEATURES =====
    sec = scan_data.get('features', {})

    features['av_enabled'] = 1 if sec.get('av_enabled') else 0
    features['firewall_any_off'] = 1 if sec.get('firewall_any_off') else 0

    # ===== ATTACK SURFACE =====
    features['software_count'] = sec.get('software_count', 0)
    features['large_attack_surface'] = 1 if sec.get('large_attack_surface') else 0

    # ===== CIS COMPLIANCE FEATURES =====
    cis = scan_data.get('cis_compliance', {})
    score_data = cis.get('compliance_score', {})
    
    features['cis_weighted_score'] = score_data.get('weighted_score', 0)
    features['cis_critical_failures'] = sum(
        1 for c in cis.get('controls', []) 
        if c.get('status') == 'non-compliant' and c.get('severity_weight') == 3
    )
    features['cis_total_failures'] = score_data.get('non_compliant_count', 0)

    return features

def get_training_data():
    """
    Fetches all scans and converts to DataFrame.
    """
    scans = list(endpoint_scans_collection().find({}, {"scan_data": 1, "_id": 0}))
    if not scans:
        return pd.DataFrame()
    
    data = []
    for s in scans:
        if 'scan_data' in s:
            data.append(extract_features(s['scan_data']))
            
    return pd.DataFrame(data)

def generate_synthetic_baseline(n_samples=20):
    """
    Generates synthetic 'good' endpoint data to serve as a baseline.
    """
    baseline = []
    for _ in range(n_samples):
        # Good security posture
        sample = {
            'listening_ports_count': np.random.randint(5, 15),
            'risky_ports_count': 0,
            'remote_registry_enabled': 0,
            'winrm_enabled': 0,
            'rdp_enabled': 0,
            'av_enabled': 1,
            'firewall_any_off': 0,
            'software_count': np.random.randint(10, 50),
            'large_attack_surface': 0,
            # CIS Compliance - Good baseline
            'cis_weighted_score': np.random.randint(85, 100),
            'cis_critical_failures': 0,
            'cis_total_failures': np.random.randint(0, 2)
        }
        baseline.append(sample)
    
    return pd.DataFrame(baseline)

def get_feature_vector(scan_data):
    """
    Extracts features and returns ordered list of values.
    """
    feats = extract_features(scan_data)
    return [feats.get(c, 0) for c in FEATURE_COLUMNS]

def train_models():
    """
    Retrains Isolation Forest and KMeans.
    Returns status dict.
    """
    global MODEL_IF, MODEL_KM
    
    # Get real data
    df_real = get_training_data()
    
    # Get synthetic baseline
    df_baseline = generate_synthetic_baseline(n_samples=20)
    
    # Combine
    if df_real.empty:
        df = df_baseline
    else:
        # We need to make sure df_real has all FEATURE_COLUMNS
        for col in FEATURE_COLUMNS:
            if col not in df_real.columns:
                df_real[col] = 0
        
        # Select only feature columns to align with baseline
        df_real = df_real[FEATURE_COLUMNS]
        df_baseline = df_baseline[FEATURE_COLUMNS] 
        
        df = pd.concat([df_real, df_baseline], ignore_index=True)
    
    # Handle missing values if any
    df = df.fillna(0)
    
    X = df.values
    
    # Train Isolation Forest
    # contamination='auto' -> 0.1 default in older sklearn, 'auto' in newer.
    # Let's use 'auto' if possible, or fixed 0.1 for stability.
    clf = IsolationForest(contamination='auto', random_state=42)
    clf.fit(X)
    MODEL_IF = clf
    
    # Predict anomalies to get scores
    scores = clf.decision_function(X)
    
    # Risk Classification with KMeans
    # If we have very few points, KMeans(3) might fail if n_samples < 3.
    n_samples = len(X)
    n_clusters = min(3, n_samples)
    
    if n_clusters < 1:
         return {"status": "error", "message": "Insufficient data"}
         
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    kmeans.fit(scores.reshape(-1, 1))
    
    centers = kmeans.cluster_centers_.flatten()
    sorted_indices = np.argsort(centers)
    
    # If n_clusters < 3, we map simplistically
    # E.g. 1 cluster -> all "Low" (or "Medium"? Let's say "Low" if not anomaly)
    # Actually, if is_anomaly is true, risk should be elevated. 
    # But let's stick to the cluster logic.
    
    risk_labels = ["High", "Medium", "Low"] # Associated with indices 0, 1, 2 (lowest score to highest)
    
    # Create mapping: cluster_idx -> Label
    # sorted_indices[0] is index of cluster with lowest score (most anomalous) -> "High"
    # But if we only have 2 clusters?
    # sorted_indices[0] -> High
    # sorted_indices[1] -> Low
    
    risk_mapping = {}
    if n_clusters == 3:
        risk_mapping[sorted_indices[0]] = "High"
        risk_mapping[sorted_indices[1]] = "Medium"
        risk_mapping[sorted_indices[2]] = "Low"
    elif n_clusters == 2:
        risk_mapping[sorted_indices[0]] = "High"
        risk_mapping[sorted_indices[1]] = "Low"
    else:
        risk_mapping[sorted_indices[0]] = "Low" # Only 1 cluster -> assume normal
        
    MODEL_KM = {
        "model": kmeans,
        "mapping": risk_mapping
    }
    
    return {"status": "success", "message": f"Trained on {len(df)} samples"}

def categorize_anomaly_score(score: float) -> dict:
    """
    Convert raw Isolation Forest anomaly score into categorical deviation bands.
    
    Threshold Bands:
    - score < -0.3: "Hardened" (better than baseline)
    - -0.3 ≤ score < -0.1: "Baseline Aligned" (normal)
    - -0.1 ≤ score < 0.2: "Moderate Deviation" (some deviations)
    - score ≥ 0.2: "Strong Deviation" (significant anomaly)
    
    Args:
        score: Raw anomaly score from Isolation Forest
    
    Returns:
        Dictionary with category, baseline_comparison, severity
    """
    if score < -0.3:
        return {
            "deviation_category": "Hardened",
            "baseline_comparison": "above_baseline",
            "severity": "positive",
            "description": "Security posture exceeds organizational baseline"
        }
    elif score < -0.1:
        return {
            "deviation_category": "Baseline Aligned",
            "baseline_comparison": "aligned",
            "severity": "none",
            "description": "Security posture aligns with organizational norms"
        }
    elif score < 0.2:
        return {
            "deviation_category": "Moderate Deviation",
            "baseline_comparison": "below_baseline",
            "severity": "moderate",
            "description": "Security posture deviates moderately from baseline"
        }
    else:
        return {
            "deviation_category": "Strong Deviation",
            "baseline_comparison": "significantly_below",
            "severity": "high",
            "description": "Security posture significantly deviates from organizational baseline"
        }


def get_deviation_factors(vector: list, risk_level: str) -> list:
    """
    Identify specific factors contributing to deviation from baseline.
    
    Args:
        vector: Feature vector
        risk_level: Risk level classification
    
    Returns:
        List of deviation factors with descriptions and impact scores
    """
    deviation_factors = []
    
    # Map feature indices to readable names
    # FEATURE_COLUMNS = [
    #     'listening_ports_count', 'risky_ports_count', 'remote_registry_enabled',
    #     'winrm_enabled', 'rdp_enabled', 'av_enabled', 'firewall_any_off',
    #     'software_count', 'large_attack_surface', 'cis_weighted_score',
    #     'cis_critical_failures', 'cis_total_failures'
    # ]
    
    # Antivirus disabled (high impact)
    if vector[5] == 0:  # av_enabled
        deviation_factors.append({
            "factor": "Antivirus Disabled",
            "impact": "high",
            "value": "0 active products",
            "recommendation": "Enable Windows Defender or install third-party AV"
        })
    
    # Firewall disabled (high impact)
    if vector[6] == 1:  # firewall_any_off
        deviation_factors.append({
            "factor": "Firewall Disabled",
            "impact": "high",
            "value": "One or more profiles off",
            "recommendation": "Enable all firewall profiles"
        })
    
    # Risky ports exposed (high impact)
    if vector[1] > 0:  # risky_ports_count
        deviation_factors.append({
            "factor": "Risky Port Exposure",
            "impact": "high",
            "value": f"{int(vector[1])} risky ports listening",
            "recommendation": "Close unnecessary ports (SMB, RDP, Telnet, etc.)"
        })
    
    # RDP enabled (medium impact)
    if vector[4] == 1:  # rdp_enabled
        deviation_factors.append({
            "factor": "RDP Enabled",
            "impact": "medium",
            "value": "Remote Desktop accessible",
            "recommendation": "Disable if not needed, or enable NLA + strong passwords"
        })
    
    # WinRM enabled (medium impact)
    if vector[3] == 1:  # winrm_enabled
        deviation_factors.append({
            "factor": "WinRM Enabled",
            "impact": "medium",
            "value": "Windows Remote Management active",
            "recommendation": "Disable if not required for management"
        })
    
    # Remote Registry enabled (medium impact)
    if vector[2] == 1:  # remote_registry_enabled
        deviation_factors.append({
            "factor": "Remote Registry Enabled",
            "impact": "medium",
            "value": "Remote registry service running",
            "recommendation": "Disable to reduce attack surface"
        })
    
    # Large attack surface (medium impact)
    if vector[8] == 1:  # large_attack_surface
        deviation_factors.append({
            "factor": "Large Attack Surface",
            "impact": "medium",
            "value": f"{int(vector[7])} software packages detected",
            "recommendation": "Remove unnecessary software and services"
        })
    
    # Low CIS compliance score (high impact)
    if vector[9] < 70:  # cis_weighted_score
        deviation_factors.append({
            "factor": "Low CIS Compliance",
            "impact": "high",
            "value": f"{vector[9]:.1f}% compliance",
            "recommendation": "Address CIS control failures (see priority actions)"
        })
    
    # Critical CIS failures (critical impact)
    if vector[10] > 0:  # cis_critical_failures
        deviation_factors.append({
            "factor": "Critical Security Controls Failed",
            "impact": "critical",
            "value": f"{int(vector[10])} critical CIS controls non-compliant",
            "recommendation": "Immediately address critical control failures"
        })
    
    # Excessive listening ports (low impact)
    if vector[0] > 30:  # listening_ports_count
        deviation_factors.append({
            "factor": "High Port Count",
            "impact": "low",
            "value": f"{int(vector[0])} ports listening",
            "recommendation": "Audit and close unnecessary services"
        })
    
    # If no specific factors identified but risk is elevated
    if not deviation_factors and risk_level in ["High", "Medium"]:
        deviation_factors.append({
            "factor": "Anomalous Pattern",
            "impact": "medium",
            "value": "Configuration deviates from organizational baseline",
            "recommendation": "Review endpoint configuration against baseline"
        })
    
    # Sort by impact (critical > high > medium > low)
    impact_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    deviation_factors.sort(key=lambda x: impact_order.get(x["impact"], 0), reverse=True)
    
    return deviation_factors


def predict_risk(scan_data):
    """
    Predicts anomaly and risk for a single scan.
    Returns dict with categorical anomaly assessment instead of raw floats.
    """
    global MODEL_IF, MODEL_KM
    
    # Auto-train attempt
    if MODEL_IF is None:
        try:
            res = train_models()
            if res.get('status') == 'error':
                 # Fallback if training failed (e.g. no data)
                 return {
                     "risk": "Unknown", 
                     "anomaly_score": 0.0, 
                     "is_anomaly": False, 
                     "details": res['message'],
                     "deviation_category": "Baseline Aligned",
                     "baseline_comparison": "unknown",
                     "deviation_factors": []
                 }
        except Exception as e:
             return {
                 "risk": "Error", 
                 "anomaly_score": 0.0, 
                 "is_anomaly": False, 
                 "details": str(e),
                 "deviation_category": "Baseline Aligned",
                 "baseline_comparison": "unknown",
                 "deviation_factors": []
             }

    # Check again if model exists (training might have failed silently or insufficient data)
    if MODEL_IF is None:
        return {
            "risk": "Unknown", 
            "anomaly_score": 0.0, 
            "is_anomaly": False, 
            "details": "Model not trained",
            "deviation_category": "Baseline Aligned",
            "baseline_comparison": "unknown",
            "deviation_factors": []
        }

    # Extract features in correct order
    vector = get_feature_vector(scan_data)
    X_new = np.array([vector])
    
    # Anomaly Score
    score = MODEL_IF.decision_function(X_new)[0]
    is_anomaly = MODEL_IF.predict(X_new)[0] == -1
    
    # Risk Level (KMeans classification)
    cluster = MODEL_KM["model"].predict([[score]])[0]
    risk_level = MODEL_KM["mapping"].get(cluster, "Unknown")
    
    # Categorical Anomaly Assessment
    anomaly_category = categorize_anomaly_score(score)
    
    # Deviation Factors
    deviation_factors = get_deviation_factors(vector, risk_level)
    
    # Details generation for UX (legacy compatibility)
    details = []
    if risk_level in ["High", "Medium"]:
        av_enabled = vector[5]
        firewall_off = vector[6]
        
        if av_enabled == 0:
            details.append("Antivirus Disabled")
        if firewall_off == 1:
            details.append("Firewall Disabled")
        if vector[1] > 0:
            details.append(f"{vector[1]} Risky Ports")
            
        if not details:
            details.append(f"Anomalous Behavior (Score: {score:.2f})")
    
    detail_str = ", ".join(details)
    
    # Analysis breakdown (legacy compatibility)
    analysis_breakdown = []
    if risk_level in ["High", "Medium"] or is_anomaly:
        av_enabled = vector[5]
        firewall_off = vector[6]
        
        if av_enabled == 0:
            analysis_breakdown.append(["Antivirus Disabled", 0.5])
        if firewall_off == 1:
            analysis_breakdown.append(["Firewall Disabled", 0.8])
        if vector[1] > 0:
            analysis_breakdown.append([f"{int(vector[1])} Risky Ports", 0.2 * vector[1]])
        if vector[8] == 1: # large_attack_surface
             analysis_breakdown.append(["Large Attack Surface", 0.3])
            
        if not analysis_breakdown:
             analysis_breakdown.append(["Anomalous Pattern Detected", abs(score)])

    return {
        "risk": risk_level, 
        "anomaly_score": float(score),  # Keep for internal use, but don't display to user
        "is_anomaly": bool(is_anomaly) or (risk_level == "High"),
        "details": detail_str,
        "breakdown": analysis_breakdown,
        # NEW: Categorical Anomaly Assessment
        "deviation_category": anomaly_category["deviation_category"],
        "baseline_comparison": anomaly_category["baseline_comparison"],
        "deviation_severity": anomaly_category["severity"],
        "deviation_description": anomaly_category["description"],
        "deviation_factors": deviation_factors
    }
