# to be run on main PC

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

def _host_id(scan: Dict) -> str:
    """Return a stable identifier for the host that produced this scan."""
    hostname = scan.get("hostname") or (scan.get("system") or {}).get("hostname")
    if hostname:
        return str(hostname).strip().lower()
    return str(id(scan))


def analyze_systemic_risk(
    scan_results: List[Dict],
    threshold: float = DEFAULT_THRESHOLD
) -> Dict:
    """
    Perform organization-level normalization of endpoint posture signals.
    Counts unique hosts only (same host with multiple scans is counted once).
    """

    if not scan_results:
        raise ValueError("No scan results provided")

    # Group scans by host so we count each host at most once
    host_to_scan: Dict[str, Dict] = {}
    for scan in scan_results:
        hid = _host_id(scan)
        if hid not in host_to_scan:
            host_to_scan[hid] = scan

    unique_scans = list(host_to_scan.values())
    total_hosts = len(unique_scans)

    issue_counter = defaultdict(int)

    for scan in unique_scans:
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

        # --- CIS Compliance ---
        cis = scan.get("cis_compliance", {})
        cis_score = cis.get("compliance_score", {})
        cis_controls = cis.get("controls", [])
        
        # Track CIS weighted score
        weighted_score = cis_score.get("weighted_score", 0)
        if weighted_score < 70:  # Below 70% is concerning
            issue_counter["cis_low_compliance"] += 1
        
        # Track critical CIS failures
        critical_failures = sum(
            1 for c in cis_controls 
            if c.get("status") == "non-compliant" and c.get("severity_weight") == 3
        )
        if critical_failures > 0:
            issue_counter["cis_critical_failures"] += 1
        
        # Track specific high-impact CIS controls
        for control in cis_controls:
            if control.get("status") == "non-compliant":
                cid = control.get("control_id", "")
                
                # Guest Account (Critical)
                if cid == "2.3.1":
                    issue_counter["cis_guest_account_enabled"] += 1
                
                # BitLocker (Critical)
                elif cid == "18.9.3":
                    issue_counter["cis_bitlocker_disabled"] += 1
                
                # SMBv1 (Critical)
                elif cid == "18.3.1":
                    issue_counter["cis_smbv1_enabled"] += 1
                
                # Password Length (High)
                elif cid == "1.1.1":
                    issue_counter["cis_weak_password_policy"] += 1
                
                # RDP Enabled (High)
                elif cid == "18.9.1":
                    issue_counter["cis_rdp_enabled"] += 1

    # -------------------------------
    # Normalization: Deciding whether something is an exception or the norm.
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
    scans_folder = os.path.join(project_root, "scans\\ScanV2")       #relative path(to change)
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
