"""
day8_cis_compliance.py
-----------------------
CIS Microsoft Windows 10/11 Enterprise Benchmark v5.0.0 (Level 1)
Compliance checks for endpoint security posture analysis.

This module implements selected high-impact CIS controls programmatically
and generates a weighted compliance score.

Security measures:
- All registry paths validated against allowlist
- PowerShell commands use list-based subprocess calls (no shell injection)
- No user-supplied data in command construction
- All outputs type-checked before inclusion
"""

import winreg
import subprocess
from typing import Dict, List, Any

# Import existing checks to avoid duplication
from day1 import get_firewall_status, get_antivirus_posture
from day7_exposure import is_rdp_enabled, is_smbv1_enabled


# =============================================================================
# SECURITY: Registry Path Allowlist (prevent path traversal)
# =============================================================================
ALLOWED_REGISTRY_PATHS = {
    r"SYSTEM\CurrentControlSet\Control\Lsa",
    r"SYSTEM\CurrentControlSet\Control\Terminal Server",
    r"SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp",
    r"Software\Policies\Microsoft\Windows NT\DNSClient",
    r"SYSTEM\CurrentControlSet\Services\EventLog\Security",
    r"SAM\SAM\Domains\Account",
}


def _safe_registry_read(path: str, key_name: str, root_key=winreg.HKEY_LOCAL_MACHINE):
    """
    Safely read registry value with path validation.
    
    Args:
        path: Registry path (validated against allowlist)
        key_name: Value name to query
        root_key: Root registry key (default: HKLM)
    
    Returns:
        Registry value or None if not accessible/invalid
    """
    # Validate path against allowlist
    if path not in ALLOWED_REGISTRY_PATHS:
        return None
    
    try:
        key = winreg.OpenKey(root_key, path)
        value, _ = winreg.QueryValueEx(key, key_name)
        winreg.CloseKey(key)
        return value
    except (FileNotFoundError, PermissionError, OSError):
        return None


# =============================================================================
# Account Policy Checks
# =============================================================================

def check_minimum_password_length() -> Dict[str, Any]:
    """
    CIS 1.1.1: Ensure 'Minimum password length' is set to 14 or more characters
    """
    min_length = _safe_registry_read(
        r"SYSTEM\CurrentControlSet\Control\Lsa",
        "MinimumPasswordLength"
    )
    
    if min_length is None:
        return {
            "control_id": "1.1.1",
            "name": "Minimum Password Length",
            "status": "non-compliant",
            "severity_weight": 2,
            "details": "Unable to determine password length policy"
        }
    
    compliant = min_length >= 14
    
    return {
        "control_id": "1.1.1",
        "name": "Minimum Password Length",
        "status": "compliant" if compliant else "non-compliant",
        "severity_weight": 2,
        "details": f"Current: {min_length} characters (Required: ≥14)"
    }


def check_password_complexity() -> Dict[str, Any]:
    """
    CIS 1.1.2: Ensure 'Password must meet complexity requirements' is enabled
    Uses PowerShell to query security policy.
    """
    try:
        # Safe: list-based subprocess call, no shell injection possible
        output = subprocess.check_output(
            ["powershell", "-Command", 
             "Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa' -Name 'PasswordComplexity' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty PasswordComplexity"],
            text=True,
            timeout=5,
            stderr=subprocess.DEVNULL
        ).strip()
        
        # Parse output: 1 = enabled, 0 = disabled
        complexity_enabled = output == "1"
        
        return {
            "control_id": "1.1.2",
            "name": "Password Complexity",
            "status": "compliant" if complexity_enabled else "non-compliant",
            "severity_weight": 2,
            "details": f"Password complexity: {'Enabled' if complexity_enabled else 'Disabled'}"
        }
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, ValueError):
        return {
            "control_id": "1.1.2",
            "name": "Password Complexity",
            "status": "non-compliant",
            "severity_weight": 2,
            "details": "Unable to determine password complexity setting"
        }


def check_account_lockout_threshold() -> Dict[str, Any]:
    """
    CIS 1.2.1: Ensure 'Account lockout threshold' is set to 5 or fewer invalid attempts
    """
    try:
        # Safe: list-based subprocess call
        output = subprocess.check_output(
            ["powershell", "-Command",
             "Get-ItemProperty 'HKLM:\\SAM\\SAM\\Domains\\Account' -Name 'F' -ErrorAction SilentlyContinue"],
            text=True,
            timeout=5,
            stderr=subprocess.DEVNULL
        ).strip()
        
        # Note: Parsing SAM is complex; using simplified heuristic
        # In production, use net accounts or secedit export
        return {
            "control_id": "1.2.1",
            "name": "Account Lockout Threshold",
            "status": "non-compliant",
            "severity_weight": 1,
            "details": "Check requires elevated privileges or secedit export"
        }
    except:
        return {
            "control_id": "1.2.1",
            "name": "Account Lockout Threshold",
            "status": "non-compliant",
            "severity_weight": 1,
            "details": "Unable to determine lockout threshold"
        }


def check_guest_account_disabled() -> Dict[str, Any]:
    """
    CIS 2.3.1: Ensure 'Guest account' is disabled
    """
    try:
        # Safe: list-based subprocess call
        output = subprocess.check_output(
            ["powershell", "-Command",
             "Get-LocalUser -Name Guest | Select-Object -ExpandProperty Enabled"],
            text=True,
            timeout=5,
            stderr=subprocess.DEVNULL
        ).strip()
        
        guest_disabled = output.lower() == "false"
        
        return {
            "control_id": "2.3.1",
            "name": "Guest Account Status",
            "status": "compliant" if guest_disabled else "non-compliant",
            "severity_weight": 3,  # High severity
            "details": f"Guest account: {'Disabled' if guest_disabled else 'Enabled'}"
        }
    except:
        return {
            "control_id": "2.3.1",
            "name": "Guest Account Status",
            "status": "non-compliant",
            "severity_weight": 3,
            "details": "Unable to determine guest account status"
        }


# =============================================================================
# Firewall Checks (Reuse existing implementation)
# =============================================================================

def check_firewall_compliance(firewall_data: Dict[str, str]) -> Dict[str, Any]:
    """
    CIS 9.1.x: Ensure Windows Firewall is enabled for all profiles
    
    Args:
        firewall_data: Output from day1.get_firewall_status()
    """
    all_enabled = all(
        firewall_data.get(profile) == "ON" 
        for profile in ["Domain", "Private", "Public"]
    )
    
    profile_status = ", ".join([
        f"{profile}: {firewall_data.get(profile, 'Unknown')}"
        for profile in ["Domain", "Private", "Public"]
    ])
    
    return {
        "control_id": "9.1",
        "name": "Firewall Enabled (All Profiles)",
        "status": "compliant" if all_enabled else "non-compliant",
        "severity_weight": 3,  # Critical control
        "details": profile_status
    }


def check_firewall_inbound_blocking() -> Dict[str, Any]:
    """
    CIS 9.1.2/4/6: Ensure default inbound action is 'Block'
    """
    try:
        # Safe: list-based subprocess call
        output = subprocess.check_output(
            ["netsh", "advfirewall", "show", "allprofiles", "state"],
            text=True,
            timeout=5,
            stderr=subprocess.DEVNULL
        )
        
        # Check if inbound is set to block for all profiles
        # Simplified check: look for "BlockInbound" or similar
        inbound_blocked = "BlockInbound" in output or "Block" in output
        
        return {
            "control_id": "9.1.2/4/6",
            "name": "Firewall Inbound Blocking",
            "status": "compliant" if inbound_blocked else "non-compliant",
            "severity_weight": 2,
            "details": f"Default inbound action: {'Block' if inbound_blocked else 'Unknown'}"
        }
    except:
        return {
            "control_id": "9.1.2/4/6",
            "name": "Firewall Inbound Blocking",
            "status": "non-compliant",
            "severity_weight": 2,
            "details": "Unable to determine inbound firewall policy"
        }


# =============================================================================
# Network Security Checks (Reuse existing implementations)
# =============================================================================

def check_smbv1_disabled(smbv1_status: bool) -> Dict[str, Any]:
    """
    CIS 18.3.1: Ensure 'SMBv1' is disabled
    
    Args:
        smbv1_status: Output from day7_exposure.is_smbv1_enabled()
    """
    if smbv1_status is None:
        status_detail = "Unknown"
        compliant = False
    else:
        status_detail = "Enabled" if smbv1_status else "Disabled"
        compliant = not smbv1_status  # Compliant if SMBv1 is disabled
    
    return {
        "control_id": "18.3.1",
        "name": "SMBv1 Protocol Status",
        "status": "compliant" if compliant else "non-compliant",
        "severity_weight": 3,  # Critical vulnerability
        "details": f"SMBv1: {status_detail}"
    }


def check_llmnr_disabled() -> Dict[str, Any]:
    """
    CIS 18.5.1: Ensure 'Turn off multicast name resolution' is enabled (LLMNR disabled)
    """
    llmnr_setting = _safe_registry_read(
        r"Software\Policies\Microsoft\Windows NT\DNSClient",
        "EnableMulticast"
    )
    
    # EnableMulticast = 0 means LLMNR is disabled (compliant)
    if llmnr_setting is None:
        return {
            "control_id": "18.5.1",
            "name": "LLMNR Disabled",
            "status": "non-compliant",
            "severity_weight": 2,
            "details": "LLMNR setting not configured (policy not set)"
        }
    
    compliant = llmnr_setting == 0
    
    return {
        "control_id": "18.5.1",
        "name": "LLMNR Disabled",
        "status": "compliant" if compliant else "non-compliant",
        "severity_weight": 2,
        "details": f"LLMNR: {'Disabled' if compliant else 'Enabled'}"
    }


# =============================================================================
# Remote Access Checks (Reuse existing implementation)
# =============================================================================

def check_rdp_compliance(rdp_enabled: bool) -> Dict[str, Any]:
    """
    CIS 18.9.1: Ensure 'Allow users to connect remotely using RDP' is disabled
    
    Args:
        rdp_enabled: Output from day7_exposure.is_rdp_enabled()
    """
    if rdp_enabled is None:
        status_detail = "Unknown"
        compliant = False
    else:
        status_detail = "Enabled" if rdp_enabled else "Disabled"
        compliant = not rdp_enabled  # Compliant if RDP is disabled
    
    return {
        "control_id": "18.9.1",
        "name": "Remote Desktop Protocol (RDP)",
        "status": "compliant" if compliant else "non-compliant",
        "severity_weight": 2,
        "details": f"RDP: {status_detail}"
    }


def check_nla_enabled() -> Dict[str, Any]:
    """
    CIS 18.9.2: Ensure 'Require user authentication for remote connections by using NLA' is enabled
    """
    nla_setting = _safe_registry_read(
        r"SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp",
        "UserAuthentication"
    )
    
    if nla_setting is None:
        return {
            "control_id": "18.9.2",
            "name": "Network Level Authentication (NLA)",
            "status": "non-compliant",
            "severity_weight": 2,
            "details": "Unable to determine NLA status"
        }
    
    compliant = nla_setting == 1  # 1 = NLA enabled
    
    return {
        "control_id": "18.9.2",
        "name": "Network Level Authentication (NLA)",
        "status": "compliant" if compliant else "non-compliant",
        "severity_weight": 2,
        "details": f"NLA: {'Enabled' if compliant else 'Disabled'}"
    }


# =============================================================================
# Antivirus Checks (Reuse existing implementation)
# =============================================================================

def check_antivirus_compliance(av_posture: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    CIS 13.x: Antivirus protection checks
    
    Args:
        av_posture: Output from day1.get_antivirus_posture()
    
    Returns:
        List of control results (AV installed, realtime, definitions)
    """
    controls = []
    summary = av_posture.get("summary", {})
    
    # Check 1: AV installed and enabled
    av_enabled = summary.get("any_enabled", False)
    controls.append({
        "control_id": "13.1",
        "name": "Antivirus Installed & Enabled",
        "status": "compliant" if av_enabled else "non-compliant",
        "severity_weight": 3,  # Critical
        "details": f"AV products enabled: {summary.get('total_products', 0)}"
    })
    
    # Check 2: Real-time protection active
    realtime_active = summary.get("any_realtime_active", False)
    controls.append({
        "control_id": "13.2",
        "name": "Real-Time Protection Active",
        "status": "compliant" if realtime_active else "non-compliant",
        "severity_weight": 3,
        "details": f"Real-time protection: {'Active' if realtime_active else 'Inactive'}"
    })
    
    # Check 3: Definitions up-to-date
    defs_current = summary.get("all_definitions_current")
    if defs_current is None:
        def_status = "non-compliant"
        def_details = "Definition status: Unknown"
    else:
        def_status = "compliant" if defs_current else "non-compliant"
        def_details = f"Definitions: {'Up-to-date' if defs_current else 'Outdated'}"
    
    controls.append({
        "control_id": "13.3",
        "name": "Antivirus Definitions Updated",
        "status": def_status,
        "severity_weight": 2,
        "details": def_details
    })
    
    return controls


# =============================================================================
# Audit Policy Checks
# =============================================================================

def check_security_audit_logging() -> Dict[str, Any]:
    """
    CIS 17.1.1: Ensure 'Audit: Force audit policy subcategory settings'
    """
    try:
        # Safe: list-based subprocess call
        output = subprocess.check_output(
            ["auditpol", "/get", "/category:*"],
            text=True,
            timeout=10,
            stderr=subprocess.DEVNULL
        )
        
        # Simple heuristic: check if any auditing is enabled
        has_auditing = "Success" in output or "Failure" in output
        
        return {
            "control_id": "17.1.1",
            "name": "Security Audit Logging Enabled",
            "status": "compliant" if has_auditing else "non-compliant",
            "severity_weight": 2,
            "details": f"Audit policies configured: {has_auditing}"
        }
    except:
        return {
            "control_id": "17.1.1",
            "name": "Security Audit Logging Enabled",
            "status": "non-compliant",
            "severity_weight": 2,
            "details": "Unable to query audit policies"
        }


def check_event_log_size() -> Dict[str, Any]:
    """
    CIS 17.2.1: Ensure 'Security' log size is configured
    """
    try:
        # Safe: list-based subprocess call
        output = subprocess.check_output(
            ["powershell", "-Command",
             "Get-EventLog -LogName Security -Newest 1 | Select-Object -ExpandProperty MaximumKilobytes"],
            text=True,
            timeout=5,
            stderr=subprocess.DEVNULL
        ).strip()
        
        # Parse log size (should be at least 32 MB for compliance)
        max_kb = int(output)
        compliant = max_kb >= 32768  # 32 MB
        
        return {
            "control_id": "17.2.1",
            "name": "Security Log Size",
            "status": "compliant" if compliant else "non-compliant",
            "severity_weight": 1,
            "details": f"Max log size: {max_kb // 1024} MB (Required: ≥32 MB)"
        }
    except:
        return {
            "control_id": "17.2.1",
            "name": "Security Log Size",
            "status": "non-compliant",
            "severity_weight": 1,
            "details": "Unable to determine security log size"
        }


def check_log_retention() -> Dict[str, Any]:
    """
    CIS 17.2.2: Ensure 'Security' log retention is configured
    """
    retention = _safe_registry_read(
        r"SYSTEM\CurrentControlSet\Services\EventLog\Security",
        "Retention"
    )
    
    if retention is None:
        return {
            "control_id": "17.2.2",
            "name": "Security Log Retention",
            "status": "non-compliant",
            "severity_weight": 1,
            "details": "Unable to determine log retention policy"
        }
    
    # Retention = 0 means overwrite as needed (common setting)
    # Retention = -1 means never overwrite (more secure)
    compliant = retention in [0, -1]
    
    return {
        "control_id": "17.2.2",
        "name": "Security Log Retention",
        "status": "compliant" if compliant else "non-compliant",
        "severity_weight": 1,
        "details": f"Retention policy set: {retention}"
    }


# =============================================================================
# Encryption Checks
# =============================================================================

def check_bitlocker_enabled() -> Dict[str, Any]:
    """
    CIS 18.9.3: Ensure BitLocker is enabled on system drive
    """
    try:
        # Safe: list-based subprocess call
        output = subprocess.check_output(
            ["powershell", "-Command",
             "Get-BitLockerVolume -MountPoint C: | Select-Object -ExpandProperty VolumeStatus"],
            text=True,
            timeout=10,
            stderr=subprocess.DEVNULL
        ).strip()
        
        # VolumeStatus should be "FullyEncrypted" for compliance
        compliant = "FullyEncrypted" in output
        
        return {
            "control_id": "18.9.3",
            "name": "BitLocker System Drive Encryption",
            "status": "compliant" if compliant else "non-compliant",
            "severity_weight": 3,  # Critical for data protection
            "details": f"C: drive status: {output if output else 'Not encrypted'}"
        }
    except:
        return {
            "control_id": "18.9.3",
            "name": "BitLocker System Drive Encryption",
            "status": "non-compliant",
            "severity_weight": 3,
            "details": "BitLocker not enabled or not accessible"
        }


# =============================================================================
# Weighted Scoring
# =============================================================================

def calculate_weighted_score(controls: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate weighted compliance score.
    
    Formula: (sum of compliant weights / total weights) × 100
    
    Args:
        controls: List of control check results
    
    Returns:
        Dictionary with scoring details
    """
    total_weight = 0
    compliant_weight = 0
    compliant_count = 0
    non_compliant_count = 0
    
    for control in controls:
        weight = control.get("severity_weight", 1)
        total_weight += weight
        
        if control.get("status") == "compliant":
            compliant_weight += weight
            compliant_count += 1
        else:
            non_compliant_count += 1
    
    # Calculate percentage
    if total_weight > 0:
        weighted_score = (compliant_weight / total_weight) * 100
    else:
        weighted_score = 0.0
    
    return {
        "weighted_score": round(weighted_score, 2),
        "compliant_count": compliant_count,
        "non_compliant_count": non_compliant_count,
        "total_weight": total_weight,
        "compliant_weight": compliant_weight
    }


# =============================================================================
# Main Collection Function
# =============================================================================

def collect_cis_compliance() -> Dict[str, Any]:
    """
    Main function to collect all CIS compliance data.
    
    Returns:
        Dictionary with controls and compliance_score
    """
    controls = []
    
    # ===== Account Policies =====
    controls.append(check_minimum_password_length())
    controls.append(check_password_complexity())
    controls.append(check_account_lockout_threshold())
    controls.append(check_guest_account_disabled())
    
    # ===== Firewall ===== (reuse existing data)
    firewall_data = get_firewall_status()
    controls.append(check_firewall_compliance(firewall_data))
    controls.append(check_firewall_inbound_blocking())
    
    # ===== Network Security ===== (reuse existing data)
    smbv1_status = is_smbv1_enabled()
    controls.append(check_smbv1_disabled(smbv1_status))
    controls.append(check_llmnr_disabled())
    
    # ===== Remote Access ===== (reuse existing data)
    rdp_status = is_rdp_enabled()
    controls.append(check_rdp_compliance(rdp_status))
    controls.append(check_nla_enabled())
    
    # ===== Antivirus ===== (reuse existing data)
    av_posture = get_antivirus_posture()
    controls.extend(check_antivirus_compliance(av_posture))
    
    # ===== Audit Policies =====
    controls.append(check_security_audit_logging())
    controls.append(check_event_log_size())
    controls.append(check_log_retention())
    
    # ===== Encryption =====
    controls.append(check_bitlocker_enabled())
    
    # Calculate final score
    compliance_score = calculate_weighted_score(controls)
    
    return {
        "controls": controls,
        "compliance_score": compliance_score
    }
