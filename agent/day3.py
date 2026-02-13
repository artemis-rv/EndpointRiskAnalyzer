#feature engineering and risk scoring

from day4 import calculate_risk_score

def bool_to_int(val):

    #Converting boolean like values for ML

    if val in [True, "True",1]:
        return 1
    if val in [False, "False", 0]:
        return 0
    return -1


#extracting features from scans

def extract_features(scan):
    #numeric feature vector

    features={}

    # ========================
    # Endpoint protection
    # ========================

    defender_status=scan["security"]["defender"].get("realtime_protection")
    features["av_enabled"]=bool_to_int(defender_status)

    firewall=scan["security"]["firewall"]
    features["firewall_public_on"]=1 if firewall.get("Public")=="ON" else 0
    features["firewall_any_off"]=1 if "OFF" in firewall.values() else 0


    # ========================
    # Runtime Exposure
    # ========================

    java_present=scan["runtimes"]["java"].get("present")
    python_present=scan["runtimes"]["python"].get("present")

    features["java_present"]=bool_to_int(java_present)
    features["python_present"]=bool_to_int(python_present)


    # ========================
    # Attack surfaces
    # ========================

    software_count=scan["installed_softwares"]
    features["software_count"]=len(software_count)
    features["large_attack_surface"]=1 if len(software_count)>100 else 0

    # ========================
    # System context
    # ========================

    os_name = scan["system"]["os"]
    features["is_windows"] = 1 if os_name == "Windows" else 0

    # OS build heuristic (last number in version)
    try:
        build = int(scan["system"]["os_version"].split(".")[-1])
    except:
        build = -1

    features["os_build_number"] = build

    # ========================
    # CIS Compliance Features
    # ========================
    
    cis = scan.get("cis_compliance", {})
    score_data = cis.get("compliance_score", {})
    
    features["cis_weighted_score"] = score_data.get("weighted_score", 0)
    features["cis_critical_failures"] = sum(
        1 for c in cis.get("controls", []) 
        if c.get("status") == "non-compliant" and c.get("severity_weight") == 3
    )
    features["cis_total_failures"] = score_data.get("non_compliant_count", 0)

    # ========================
    # Risk Calculation
    # ========================

    risk=calculate_risk_score(scan,features)

    return features, risk

