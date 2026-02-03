import json
import os
from collections import defaultdict
from typing import List, Dict


# -------------------------------
# Configuration (Policy Layer)
# -------------------------------

DEFAULT_THRESHOLD = 0.7  # 70% endpoints → systemic


# -------------------------------
# Utility Functions
# -------------------------------

def load_scan_files(scan_folder: str) -> List[Dict]:
    """
    Load all JSON scan files from a folder.
    Each file represents one endpoint scan.
    """
    scans = []

    if not os.path.isdir(scan_folder):
        raise FileNotFoundError(f"Scan folder not found: {scan_folder}")

    for file_name in os.listdir(scan_folder):
        if file_name.endswith(".json"):
            file_path = os.path.join(scan_folder, file_name)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    scans.append(json.load(f))
            except Exception as e:
                print(f"[WARN] Failed to load {file_name}: {e}")

    return scans


# -------------------------------
# Core Aggregation Logic
# -------------------------------

def analyze_systemic_risk(
    scan_results: List[Dict],
    threshold: float = DEFAULT_THRESHOLD
) -> Dict:
    """
    Perform organization-level normalization of endpoint posture signals.
    """

    total_hosts = len(scan_results)
    if total_hosts == 0:
        raise ValueError("No scan results provided")

    issue_counter = defaultdict(int)

    for scan in scan_results:

        # --- Security Controls ---
        security_controls = scan.get("security_controls", {})
        if security_controls.get("firewall_status") is False:
            issue_counter["firewall_disabled"] += 1

        if security_controls.get("antivirus_effective_status") in ["disabled", "unknown"]:
            issue_counter["antivirus_not_confirmed"] += 1

        # --- Privilege Posture ---
        privilege = scan.get("privilege_posture", {})
        if privilege.get("user_is_admin") is True:
            issue_counter["admin_user"] += 1

        if privilege.get("uac_enabled") is False:
            issue_counter["uac_disabled"] += 1

        # --- Exposure Posture ---
        exposure = scan.get("exposure_posture", {})
        if exposure.get("rdp_enabled") is True:
            issue_counter["rdp_enabled"] += 1

        if exposure.get("smbv1_enabled") is True:
            issue_counter["smbv1_enabled"] += 1

        if exposure.get("winrm_enabled") is True:
            issue_counter["winrm_enabled"] += 1

        if exposure.get("risky_listening_ports"):
            issue_counter["risky_ports_exposed"] += 1

    # -------------------------------
    # Normalization
    # -------------------------------

    systemic_issues = []
    isolated_issues = []

    for issue, count in issue_counter.items():
        ratio = count / total_hosts

        finding = {
            "issue": issue,
            "affected_hosts": count,
            "total_hosts": total_hosts,
            "affected_percentage": round(ratio * 100, 2),
        }

        if ratio >= threshold:
            finding["classification"] = "systemic"
            systemic_issues.append(finding)
        else:
            finding["classification"] = "isolated"
            isolated_issues.append(finding)

    return {
        "summary": {
            "total_hosts_analyzed": total_hosts,
            "systemic_issue_count": len(systemic_issues),
            "isolated_issue_count": len(isolated_issues),
            "threshold_used": threshold,
        },
        "systemic_issues": systemic_issues,
        "isolated_issues": isolated_issues,
        "assumptions_and_limits": [
            "Analysis is based on passive endpoint evidence only",
            "No real-time detection or remediation is performed",
            "Threshold represents a policy decision, not absolute risk",
            "Findings indicate configuration patterns, not exploitability",
        ],
    }


# -------------------------------
# Main Execution
# -------------------------------

def main():
    # Path resolution relative to analysis/ folder
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    scans_folder = os.path.join(project_root, "scans")
    output_file = os.path.join(project_root, "org_posture.json")

    print("[INFO] Loading endpoint scan files...")
    scan_results = load_scan_files(scans_folder)
    print(f"[INFO] Loaded {len(scan_results)} endpoint scans")

    print("[INFO] Performing systemic posture analysis...")
    org_posture = analyze_systemic_risk(scan_results)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(org_posture, f, indent=2)

    print(f"[SUCCESS] Organization posture saved to {output_file}")


if __name__ == "__main__":
    main()
