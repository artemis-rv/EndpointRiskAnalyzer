
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
    'large_attack_surface'
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
            'large_attack_surface': 0
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

def predict_risk(scan_data):
    """
    Predicts anomaly and risk for a single scan.
    Returns dict with anomaly_score, risk_level.
    """
    global MODEL_IF, MODEL_KM
    
    # Auto-train attempt
    if MODEL_IF is None:
        try:
            res = train_models()
            if res.get('status') == 'error':
                 # Fallback if training failed (e.g. no data)
                 return {"risk": "Unknown", "anomaly_score": 0.0, "is_anomaly": False, "details": res['message']}
        except Exception as e:
             return {"risk": "Error", "anomaly_score": 0.0, "is_anomaly": False, "details": str(e)}

    # Check again if model exists (training might have failed silently or insufficient data)
    if MODEL_IF is None:
        return {"risk": "Unknown", "anomaly_score": 0.0, "is_anomaly": False, "details": "Model not trained"}

    # Extract features in correct order
    vector = get_feature_vector(scan_data)
    X_new = np.array([vector])
    
    # Anomaly Score
    score = MODEL_IF.decision_function(X_new)[0]
    is_anomaly = MODEL_IF.predict(X_new)[0] == -1
    
    # Risk Level
    # Pure ML Approach with Synthetic Baseline
    cluster = MODEL_KM["model"].predict([[score]])[0]
    risk_level = MODEL_KM["mapping"].get(cluster, "Unknown")
    
    # Details generation for UX
    details = []
    
    # Map features to names for feedback
    # Only adding details if score is low (anomalous) or risk is High/Medium
    if risk_level in ["High", "Medium"]:
        # Naive explanation: check simple rules just for display string, but Risk Classification is PURE ML.
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
    
    return {
        "risk": risk_level, 
        "anomaly_score": float(score),
        "is_anomaly": bool(is_anomaly) or (risk_level == "High"),
        "details": detail_str
    }
