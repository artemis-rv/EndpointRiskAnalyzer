
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
MODEL_IS_STALE = False

def mark_model_stale():
    """Marks the ML model ready for retraining upon next prediction."""
    global MODEL_IS_STALE
    MODEL_IS_STALE = True
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

    # Extract posture objects from scan data for modularity
    exposure = scan_data.get('exposure_posture', {})
    security = scan_data.get('security', {})
    av_posture = scan_data.get('antivirus_posture', {})
    software = scan_data.get('software_inventory', {})
    cis = scan_data.get('cis_compliance', {})

    # ===== NETWORK FEATURES =====
    features['listening_ports_count'] = exposure.get('listening_ports_count', 0)

    risky_ports = exposure.get('risky_listening_ports', [])
    features['risky_ports_count'] = len(risky_ports) if isinstance(risky_ports, list) else 0

    # ===== EXPOSURE POSTURE =====
    features['remote_registry_enabled'] = 1 if exposure.get('remote_registry_enabled') else 0
    features['winrm_enabled'] = 1 if exposure.get('winrm_enabled') else 0
    features['rdp_enabled'] = 1 if exposure.get('rdp_enabled') else 0

    # ===== SECURITY FEATURES =====
    # Using the summary status from antivirus_posture (WMI-based)
    features['av_enabled'] = 1 if av_posture.get('summary', {}).get('any_enabled') else 0
    
    # Check if any firewall profile is OFF (Domain, Private, or Public)
    firewall = security.get('firewall', {})
    firewall_off = any(str(state).upper() == "OFF" for state in firewall.values())
    features['firewall_any_off'] = 1 if firewall_off else 0

    # ===== ATTACK SURFACE =====
    # Use the total unique software count from the comprehensive inventory
    software_count = software.get('counts', {}).get('total_unique', 0)
    features['software_count'] = software_count
    features['large_attack_surface'] = 1 if software_count > 100 else 0

    # ===== CIS COMPLIANCE FEATURES =====
    score_data = cis.get('compliance_score', {})
    
    features['cis_weighted_score'] = score_data.get('weighted_score', 0)
    features['cis_critical_failures'] = sum(
        1 for c in cis.get('controls', []) 
        if str(c.get('status', '')).lower() in ['non-compliant', 'non_compliant'] 
        and c.get('severity_weight') == 3
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

def generate_synthetic_baseline():
    """
    Generates synthetic benchmark endpoint data representing 'Good', 'Medium', and 'High' risk.
    This provides anchor points for KMeans scaling, avoiding treating normal endpoints as massive anomalies.
    """
    baseline = []
    
    # Generate 50 'Good' (Normal) endpoints
    # Reflects typical corporate build, not an impossible utopia
    for _ in range(50):
        baseline.append({
            'listening_ports_count': np.random.randint(20, 80), # Normal windows PC has 40+ ports listening
            'risky_ports_count': 0,
            'remote_registry_enabled': 0,
            'winrm_enabled': 0,
            'rdp_enabled': 0,
            'av_enabled': 1,
            'firewall_any_off': 0,
            'software_count': np.random.randint(20, 120),
            'large_attack_surface': 0,
            'cis_weighted_score': np.random.randint(70, 100),
            'cis_critical_failures': 0,
            'cis_total_failures': np.random.randint(0, 5)
        })

    # Generate 15 'Medium' risk endpoints
    for _ in range(15):
        baseline.append({
            'listening_ports_count': np.random.randint(60, 120),
            'risky_ports_count': np.random.randint(0, 2),
            'remote_registry_enabled': np.random.choice([0, 1], p=[0.7, 0.3]),
            'winrm_enabled': np.random.choice([0, 1], p=[0.5, 0.5]),
            'rdp_enabled': np.random.choice([0, 1], p=[0.5, 0.5]),
            'av_enabled': 1,
            'firewall_any_off': 0,
            'software_count': np.random.randint(100, 200),
            'large_attack_surface': 1,
            'cis_weighted_score': np.random.randint(40, 70),
            'cis_critical_failures': np.random.randint(0, 2),
            'cis_total_failures': np.random.randint(5, 15)
        })

    # Generate 10 'High' (Bad) risk endpoints
    for _ in range(10):
        baseline.append({
            'listening_ports_count': np.random.randint(100, 200),
            'risky_ports_count': np.random.randint(1, 5),
            'remote_registry_enabled': 1,
            'winrm_enabled': 1,
            'rdp_enabled': 1,
            'av_enabled': np.random.choice([0, 1], p=[0.8, 0.2]), # Often no AV
            'firewall_any_off': np.random.choice([0, 1], p=[0.2, 0.8]), # Often firewall off
            'software_count': np.random.randint(150, 300),
            'large_attack_surface': 1,
            'cis_weighted_score': np.random.randint(10, 40),
            'cis_critical_failures': np.random.randint(2, 6),
            'cis_total_failures': np.random.randint(15, 30)
        })
    
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
    global MODEL_IF, MODEL_KM, MODEL_IS_STALE
    
    # Get real data
    df_real = get_training_data()
    
    # Get synthetic baseline
    df_baseline = generate_synthetic_baseline()
    
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
        # df = df_baseline
    
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
    
    MODEL_IS_STALE = False
    
    # Evaluate model against synthetic baseline (since real data lacks ground truth labels)
    try:
        from sklearn.metrics import confusion_matrix, classification_report
        # Based on generate_synthetic_baseline(): 50 Good (Low), 15 Medium, 10 High
        true_labels = ["Low"] * 50 + ["Medium"] * 15 + ["High"] * 10
        baseline_X = df_baseline.values
        baseline_scores = clf.decision_function(baseline_X)
        baseline_clusters = kmeans.predict(baseline_scores.reshape(-1, 1))
        pred_labels = [risk_mapping.get(c, "Unknown") for c in baseline_clusters]
        
        print("\n" + "="*60)
        print("ML MODEL EVALUATION (Synthetic Baseline)")
        print("="*60)
        print("Confusion Matrix (Rows: True, Cols: Predicted - [High, Medium, Low]):")
        print(confusion_matrix(true_labels, pred_labels, labels=["High", "Medium", "Low"]))
        print("\nClassification Report:")
        print(classification_report(true_labels, pred_labels, labels=["High", "Medium", "Low"], zero_division=0))
        print("="*60 + "\n")
    except Exception as e:
        print(f"Evaluation print failed: {e}")

    return {"status": "success", "message": f"Trained on {len(df)} samples"}

def categorize_anomaly_score(score: float) -> dict:
    """
    Convert raw Isolation Forest anomaly score into categorical deviation bands.
    
    Threshold Bands:
    - score < -0.3: "Strong Deviation" (significant anomaly)
    - -0.3 ≤ score < -0.1: "Moderate Deviation" (some deviations)
    - -0.1 ≤ score < 0.2: "Baseline Aligned" (normal)
    - score ≥ 0.2: "Hardened" (better than baseline)
    
    Args:
        score: Raw anomaly score from Isolation Forest
    
    Returns:
        Dictionary with category, baseline_comparison, severity
    """
    if score < -0.3:
        return {
            "deviation_category": "Strong Deviation",
            "baseline_comparison": "significantly_below",
            "severity": "high",
            "description": "Security posture significantly deviates from organizational baseline"
        }
    elif score < -0.1:
        return {
            "deviation_category": "Moderate Deviation",
            "baseline_comparison": "below_baseline",
            "severity": "moderate",
            "description": "Security posture deviates moderately from baseline"
        }
    elif score < 0.2:
        return {
            "deviation_category": "Baseline Aligned",
            "baseline_comparison": "aligned",
            "severity": "none",
            "description": "Security posture aligns with organizational norms"
        }
    else:
        return {
            "deviation_category": "Hardened",
            "baseline_comparison": "above_baseline",
            "severity": "positive",
            "description": "Security posture exceeds organizational baseline"
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
    global MODEL_IF, MODEL_KM, MODEL_IS_STALE
    
    # Auto-train attempt
    if MODEL_IF is None or MODEL_IS_STALE:
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
    raw_is_anomaly = MODEL_IF.predict(X_new)[0] == -1
    
    # Risk Level (KMeans classification)
    cluster = MODEL_KM["model"].predict([[score]])[0]
    risk_level = MODEL_KM["mapping"].get(cluster, "Unknown")
    
    # Strictly define an "anomaly" for the dashboard as High risk only.
    # If the model thinks it's a moderate deviation (Medium), we don't flag it as an anomaly.
    is_anomaly = (risk_level == "High")
    
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
        "is_anomaly": is_anomaly,
        "details": detail_str,
        "breakdown": analysis_breakdown,
        # NEW: Categorical Anomaly Assessment
        "deviation_category": anomaly_category["deviation_category"],
        "baseline_comparison": anomaly_category["baseline_comparison"],
        "deviation_severity": anomaly_category["severity"],
        "deviation_description": anomaly_category["description"],
        "deviation_factors": deviation_factors
    }
