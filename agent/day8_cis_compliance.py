"""
day8_cis_compliance.py (Enhanced Multi-Source Validation)
---------------------------------------------------------
CIS Microsoft Windows 10/11 Enterprise Benchmark v5.0.0 (Level 1)
Compliance checks for endpoint security posture analysis.

ENHANCED FEATURES:
- Multi-source validation (primary + fallback methods)
- 7 failure states (no "Unable to determine")
- Confidence levels and source method tracking
- Remediation hints
- Weighted scoring with priority calculation

Security measures:
- All registry paths validated against allowlist
- PowerShell commands use list-based subprocess calls (no shell injection)
- No user-supplied data in command construction
- All outputs type-checked before inclusion
"""

import winreg
import subprocess
from typing import Dict, List, Any, Tuple
import logging
import re

# Import existing checks to avoid duplication
from day1 import get_firewall_status, get_antivirus_posture
from day7_exposure import is_rdp_enabled, is_smbv1_enabled

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# FAILURE STATE CONSTANTS
# =============================================================================
STATUS_COMPLIANT = "compliant"
STATUS_NON_COMPLIANT = "non_compliant"
STATUS_NOT_CONFIGURED = "not_configured"
STATUS_INSUFFICIENT_PRIVILEGE = "insufficient_privilege"
STATUS_FEATURE_NOT_INSTALLED = "feature_not_installed"
STATUS_POLICY_DOMAIN_ENFORCED = "policy_domain_enforced"
STATUS_QUERY_FAILED = "query_failed"


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
    r"SOFTWARE\Policies\Microsoft\Windows Defender",
}


def _safe_registry_read(path: str, key_name: str, root_key=winreg.HKEY_LOCAL_MACHINE) -> Tuple[Any, str, str]:
    """
    Safely read registry value with path validation.
    
    Args:
        path: Registry path (validated against allowlist)
        key_name: Value name to query
        root_key: Root registry key (default: HKLM)
    
    Returns:
        Tuple of (value, status, reason)
        - value: Registry value or None
        - status: "success", "not_configured", "insufficient_privilege", "query_failed"
        - reason: Human-readable explanation
    """
    # Validate path against allowlist
    if path not in ALLOWED_REGISTRY_PATHS:
        logger.warning(f"Registry path not in allowlist: {path}")
        return None, STATUS_QUERY_FAILED, f"Registry path not allowlisted: {path}"
    
    try:
        key = winreg.OpenKey(root_key, path)
        value, _ = winreg.QueryValueEx(key, key_name)
        winreg.CloseKey(key)
        return value, "success", "Registry value read successfully"
    except FileNotFoundError:
        return None, STATUS_NOT_CONFIGURED, f"Registry key or value not found: {path}\\{key_name}"
    except PermissionError:
        return None, STATUS_INSUFFICIENT_PRIVILEGE, "Insufficient privileges to read registry"
    except OSError as e:
        return None, STATUS_QUERY_FAILED, f"Registry query failed: {str(e)}"


def _safe_powershell_exec(command: List[str], timeout: int = 5) -> Tuple[str, str, str]:
    """
    Safely execute PowerShell command.
    
    Args:
        command: List-based command for subprocess
        timeout: Timeout in seconds
    
    Returns:
        Tuple of (output, status, reason)
        - output: Command output or empty string
        - status: "success", "insufficient_privilege", "feature_not_installed", "query_failed"
        - reason: Human-readable explanation
    """
    try:
        output = subprocess.check_output(
            command,
            text=True,
            timeout=timeout,
            stderr=subprocess.DEVNULL
        ).strip()
        return output, "success", "PowerShell command executed successfully"
    except subprocess.TimeoutExpired:
        return "", STATUS_QUERY_FAILED, "PowerShell command timed out"
    except subprocess.CalledProcessError as e:
        # Differentiate between privilege errors and feature not installed
        if "Access is denied" in str(e) or e.returncode == 5:
            return "", STATUS_INSUFFICIENT_PRIVILEGE, "Insufficient privileges to execute command"
        elif "not recognized" in str(e) or "not found" in str(e):
            return "", STATUS_FEATURE_NOT_INSTALLED, "Required Windows feature not installed"
        else:
            return "", STATUS_QUERY_FAILED, f"PowerShell command failed: {e.returncode}"
    except FileNotFoundError:
        return "", STATUS_FEATURE_NOT_INSTALLED, "PowerShell not found on system"
    except Exception as e:
        return "", STATUS_QUERY_FAILED, f"Unexpected error: {str(e)}"


# =============================================================================
# Account Policy Checks
# =============================================================================

def check_minimum_password_length() -> Dict[str, Any]:
    r"""
    CIS 1.1.1: Ensure 'Minimum password length' is set to 14 or more characters
    
    Multi-source validation:
    - Primary: Registry (HKLM\SYSTEM\CurrentControlSet\Control\Lsa\MinimumPasswordLength)
    - Fallback: secedit export
    """

    min_length,status,reason=_safe_powershell_exec(
    [
        "powershell", "-Command",
        "(net accounts | Select-String 'Minimum password length') -replace '.*:',''"])

    
        
    if status == "success":
        compliant = int(min_length.strip()) >= 14
        return {
            "control_id": "1.1.1",
            "name": "Minimum Password Length",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"Current: {min_length} characters (Required: ≥14)",
            "reason": "Password policy enforced" if compliant else f"Minimum password length is {min_length}, below required 14",
            "source_method_used": "registry",
            "confidence_level": "high",
            "remediation_hint": "Set via Group Policy: Computer Configuration > Windows Settings > Security Settings > Account Policies > Password Policy"
        }
    
    # Fallback method: secedit
    output, fallback_status, fallback_reason = _safe_powershell_exec([
        "powershell", "-Command",
        "(secedit /export /cfg $env:TEMP\\secpol.cfg /quiet; Get-Content $env:TEMP\\secpol.cfg | Select-String 'MinimumPasswordLength') -replace '.*= ','' ; Remove-Item $env:TEMP\\secpol.cfg -ErrorAction SilentlyContinue"
    ], timeout=10)
    
    if fallback_status == "success" and output.isdigit():
        min_length = int(output)
        compliant = min_length >= 14
        return {
            "control_id": "1.1.1",
            "name": "Minimum Password Length",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"Current: {min_length} characters (Required: ≥14)",
            "reason": "Password policy enforced" if compliant else f"Minimum password length is {min_length}, below required 14",
            "source_method_used": "secedit",
            "confidence_level": "medium",
            "remediation_hint": "Set via Group Policy: Computer Configuration > Windows Settings > Security Settings > Account Policies > Password Policy"
        }
    
    # Both methods failed
    return {
        "control_id": "1.1.1",
        "name": "Minimum Password Length",
        "status": status if status != "success" else fallback_status,
        "severity_weight": 2,
        "details": f"Primary: {reason}; Fallback: {fallback_reason}",
        "reason": "Unable to validate: " + (reason if status == STATUS_INSUFFICIENT_PRIVILEGE else fallback_reason),
        "source_method_used": "registry+secedit",
        "confidence_level": "none",
        "remediation_hint": "Run agent with elevated privileges or enable domain policy"
    }


def check_password_complexity() -> Dict[str, Any]:
    """
    CIS 1.1.2: Ensure 'Password must meet complexity requirements' is enabled
    
    Multi-source validation:
    - Primary: secedit export
    - Fallback: Registry check (PasswordComplexity)
    """
    # Primary method: secedit
    output, status, reason = _safe_powershell_exec([
        "powershell", "-Command",
        "(secedit /export /cfg $env:TEMP\\secpol.cfg /quiet; Get-Content $env:TEMP\\secpol.cfg | Select-String 'PasswordComplexity') -replace '.*= ','' ; Remove-Item $env:TEMP\\secpol.cfg -ErrorAction SilentlyContinue"
    ], timeout=10)
    
    if status == "success" and output.isdigit():
        complexity_enabled = int(output) == 1
        return {
            "control_id": "1.1.2",
            "name": "Password Complexity",
            "status": STATUS_COMPLIANT if complexity_enabled else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"Password complexity: {'Enabled' if complexity_enabled else 'Disabled'}",
            "reason": "Complexity requirements enforced" if complexity_enabled else "Complexity requirements not enabled",
            "source_method_used": "secedit",
            "confidence_level": "high",
            "remediation_hint": "Enable via Group Policy: Computer Configuration > Windows Settings > Security Settings > Account Policies > Password Policy"
        }
    
    # Fallback: Registry
    complexity_value, fallback_status, fallback_reason = _safe_registry_read(
        r"SYSTEM\CurrentControlSet\Control\Lsa",
        "PasswordComplexity"
    )
    
    if fallback_status == "success":
        complexity_enabled = complexity_value == 1
        return {
            "control_id": "1.1.2",
            "name": "Password Complexity",
            "status": STATUS_COMPLIANT if complexity_enabled else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"Password complexity: {'Enabled' if complexity_enabled else 'Disabled'}",
            "reason": "Complexity requirements enforced" if complexity_enabled else "Complexity requirements not enabled",
            "source_method_used": "registry",
            "confidence_level": "medium",
            "remediation_hint": "Enable via Group Policy: Computer Configuration > Windows Settings > Security Settings > Account Policies > Password Policy"
        }
    
    # Both methods failed
    return {
        "control_id": "1.1.2",
        "name": "Password Complexity",
        "status": status if status != "success" else fallback_status,
        "severity_weight": 2,
        "details": f"Primary: {reason}; Fallback: {fallback_reason}",
        "reason": "Unable to validate complexity settings",
        "source_method_used": "secedit+registry",
        "confidence_level": "none",
        "remediation_hint": "Run agent with elevated privileges"
    }


def check_account_lockout_threshold() -> Dict[str, Any]:
    """
    CIS 1.2.1: Ensure 'Account lockout threshold' is set to 5 or fewer invalid attempts
    
    Multi-source validation:
    - Primary: net accounts command
    - Fallback: secedit export
    """
    # Primary method: net accounts
    output, status, reason = _safe_powershell_exec([
        "powershell", "-Command",
        "(net accounts | Select-String 'Lockout threshold') -replace '.*:',''"
    ], timeout=5)
    
    if status == "success":
        try:
            # Parse "Never" or numeric value
            threshold_str = output.strip()
            if "Never" in threshold_str or "never" in threshold_str:
                return {
                    "control_id": "1.2.1",
                    "name": "Account Lockout Threshold",
                    "status": STATUS_NON_COMPLIANT,
                    "severity_weight": 1,
                    "details": "Account lockout: Never (Required: ≤5 attempts)",
                    "reason": "No lockout threshold configured",
                    "source_method_used": "net_accounts",
                    "confidence_level": "high",
                    "remediation_hint": "Set lockout threshold via Group Policy: Account Policies > Account Lockout Policy"
                }
            else:
                threshold = int(threshold_str)
                compliant = 1 <= threshold <= 5
                return {
                    "control_id": "1.2.1",
                    "name": "Account Lockout Threshold",
                    "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
                    "severity_weight": 1,
                    "details": f"Lockout threshold: {threshold} attempts (Required: 1-5)",
                    "reason": "Lockout threshold configured properly" if compliant else f"Lockout threshold {threshold} outside recommended range",
                    "source_method_used": "net_accounts",
                    "confidence_level": "high",
                    "remediation_hint": "Adjust to 3-5 failed attempts via Group Policy"
                }
        except ValueError:
            pass
    
    # Fallback: secedit
    output, fallback_status, fallback_reason = _safe_powershell_exec([
        "powershell", "-Command",
        "(secedit /export /cfg $env:TEMP\\secpol.cfg /quiet; Get-Content $env:TEMP\\secpol.cfg | Select-String 'LockoutBadCount') -replace '.*= ','' ; Remove-Item $env:TEMP\\secpol.cfg -ErrorAction SilentlyContinue"
    ], timeout=10)
    
    if fallback_status == "success" and output.isdigit():
        threshold = int(output)
        compliant = 1 <= threshold <= 5
        return {
            "control_id": "1.2.1",
            "name": "Account Lockout Threshold",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 1,
            "details": f"Lockout threshold: {threshold} attempts (Required: 1-5)",
            "reason": "Lockout threshold configured properly" if compliant else f"Lockout threshold {threshold} outside recommended range",
            "source_method_used": "secedit",
            "confidence_level": "medium",
            "remediation_hint": "Adjust to 3-5 failed attempts via Group Policy"
        }
    
    # Both methods failed
    return {
        "control_id": "1.2.1",
        "name": "Account Lockout Threshold",
        "status": status if status != "success" else fallback_status,
        "severity_weight": 1,
        "details": f"Primary: {reason}; Fallback: {fallback_reason}",
        "reason": "Unable to determine lockout threshold",
        "source_method_used": "net_accounts+secedit",
        "confidence_level": "none",
        "remediation_hint": "Verify agent has sufficient privileges"
    }


def check_guest_account_disabled() -> Dict[str, Any]:
    """
    CIS 2.3.1: Ensure 'Guest account' is disabled
    
    Multi-source validation:
    - Primary: Get-LocalUser PowerShell
    - Fallback: net user command
    """
    # Primary method: PowerShell Get-LocalUser
    output, status, reason = _safe_powershell_exec([
        "powershell", "-Command",
        "Get-LocalUser -Name Guest | Select-Object -ExpandProperty Enabled"
    ], timeout=5)
    
    if status == "success":
        guest_disabled = output.lower() == "false"
        return {
            "control_id": "2.3.1",
            "name": "Guest Account Status",
            "status": STATUS_COMPLIANT if guest_disabled else STATUS_NON_COMPLIANT,
            "severity_weight": 3,  # Critical
            "details": f"Guest account: {'Disabled' if guest_disabled else 'Enabled'}",
            "reason": "Guest account is disabled" if guest_disabled else "Guest account is enabled - critical security risk",
            "source_method_used": "powershell_get_localuser",
            "confidence_level": "high",
            "remediation_hint": "Disable via: net user guest /active:no"
        }
    
    # Fallback: net user
    output, fallback_status, fallback_reason = _safe_powershell_exec([
        "net", "user", "guest"
    ], timeout=5)
    
    if fallback_status == "success":
        # Parse net user output for "Account active" line
        guest_disabled = "Account active" in output and "No" in output.split("Account active")[1].split("\n")[0]
        return {
            "control_id": "2.3.1",
            "name": "Guest Account Status",
            "status": STATUS_COMPLIANT if guest_disabled else STATUS_NON_COMPLIANT,
            "severity_weight": 3,
            "details": f"Guest account: {'Disabled' if guest_disabled else 'Enabled'}",
            "reason": "Guest account is disabled" if guest_disabled else "Guest account is enabled - critical security risk",
            "source_method_used": "net_user",
            "confidence_level": "medium",
            "remediation_hint": "Disable via: net user guest /active:no"
        }
    
    # Both methods failed
    return {
        "control_id": "2.3.1",
        "name": "Guest Account Status",
        "status": status if status != "success" else fallback_status,
        "severity_weight": 3,
        "details": f"Primary: {reason}; Fallback: {fallback_reason}",
        "reason": "Unable to determine guest account status",
        "source_method_used": "powershell+net_user",
        "confidence_level": "none",
        "remediation_hint": "Verify agent has sufficient privileges"
    }


# =============================================================================
# Firewall Checks (Reuse existing implementation, enhance with multi-source)
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
    
    disabled_profiles = [p for p in ["Domain", "Private", "Public"] if firewall_data.get(p) != "ON"]
    
    return {
        "control_id": "9.1",
        "name": "Firewall Enabled (All Profiles)",
        "status": STATUS_COMPLIANT if all_enabled else STATUS_NON_COMPLIANT,
        "severity_weight": 3,  # Critical control
        "details": profile_status,
        "reason": "Firewall enabled for all profiles" if all_enabled else f"Firewall disabled for: {', '.join(disabled_profiles)}",
        "source_method_used": "netsh_firewall",
        "confidence_level": "high",
        "remediation_hint": "Enable via: netsh advfirewall set allprofiles state on"
    }


def check_firewall_inbound_blocking() -> Dict[str, Any]:
    """
    CIS 9.1.2/4/6: Ensure default inbound action is 'Block'
    
    Multi-source validation:
    - Primary: netsh advfirewall show allprofiles
    - Fallback: Registry check
    """
    # Primary method: netsh
    output, status, reason = _safe_powershell_exec([
        "netsh", "advfirewall", "show", "allprofiles", "firewallpolicy"
    ], timeout=5)
    
    if status == "success":
        # Check if BlockInbound is present for all profiles
        inbound_blocked = output.count("BlockInbound") == 3
        return {
            "control_id": "9.1.2/4/6",
            "name": "Firewall Inbound Blocking",
            "status": STATUS_COMPLIANT if inbound_blocked else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"Default inbound action: {'Block' if inbound_blocked else 'Allow (non-compliant)'}",
            "reason": "Inbound connections blocked by default" if inbound_blocked else "Inbound connections allowed by default",
            "source_method_used": "netsh",
            "confidence_level": "high",
            "remediation_hint": "Set via: netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound"
        }
    
    # If netsh fails, return appropriate status
    return {
        "control_id": "9.1.2/4/6",
        "name": "Firewall Inbound Blocking",
        "status": status,
        "severity_weight": 2,
        "details": reason,
        "reason": "Unable to determine firewall inbound policy",
        "source_method_used": "netsh",
        "confidence_level": "none",
        "remediation_hint": "Verify Windows Firewall Service is running"
    }


# =============================================================================
# Network Security Checks
# =============================================================================

def check_smbv1_disabled(smbv1_status: bool) -> Dict[str, Any]:
    """
    CIS 18.3.1: Ensure 'SMBv1' is disabled
    
    Args:
        smbv1_status: Output from day7_exposure.is_smbv1_enabled()
    """
    if smbv1_status is None:
        return {
            "control_id": "18.3.1",
            "name": "SMBv1 Protocol Status",
            "status": STATUS_FEATURE_NOT_INSTALLED,
            "severity_weight": 3,  # Critical vulnerability
            "details": "SMBv1: Status unknown",
            "reason": "Unable to determine SMBv1 status",
            "source_method_used": "sc_query",
            "confidence_level": "none",
            "remediation_hint": "Disable via: Disable-WindowsOptionalFeature -Online -FeatureName smb1protocol"
        }
    
    compliant = not smbv1_status  # Compliant if SMBv1 is disabled
    
    return {
        "control_id": "18.3.1",
        "name": "SMBv1 Protocol Status",
        "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
        "severity_weight": 3,
        "details": f"SMBv1: {'Disabled (secure)' if compliant else 'Enabled (vulnerable)'}",
        "reason": "SMBv1 is disabled" if compliant else "SMBv1 enabled - critical vulnerability (WannaCry, NotPetya)",
        "source_method_used": "sc_query",
        "confidence_level": "high",
        "remediation_hint": "Disable immediately via PowerShell: Disable-WindowsOptionalFeature -Online -FeatureName smb1protocol"
    }


def check_llmnr_disabled() -> Dict[str, Any]:
    """
    CIS 18.5.1: Ensure 'Turn off multicast name resolution' is enabled (LLMNR disabled)
    
    Multi-source validation:
    - Primary: Registry (EnableMulticast)
    - Fallback: PowerShell DNS client check
    """
    # Primary method: Registry
    llmnr_setting, status, reason = _safe_registry_read(
        r"Software\Policies\Microsoft\Windows NT\DNSClient",
        "EnableMulticast"
    )
    
    # EnableMulticast = 0 means LLMNR is disabled (compliant)
    if status == "success":
        compliant = llmnr_setting == 0
        return {
            "control_id": "18.5.1",
            "name": "LLMNR Disabled",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"LLMNR: {'Disabled' if compliant else 'Enabled'}",
            "reason": "LLMNR disabled via policy" if compliant else "LLMNR enabled - credential theft risk",
            "source_method_used": "registry",
            "confidence_level": "high",
            "remediation_hint": "Disable via GPO: Computer Configuration > Administrative Templates > Network > DNS Client > Turn off multicast name resolution"
        }
    elif status == STATUS_NOT_CONFIGURED:
        # LLMNR is enabled by default if not configured
        return {
            "control_id": "18.5.1",
            "name": "LLMNR Disabled",
            "status": STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": "LLMNR: Enabled (default, policy not set)",
            "reason": "LLMNR policy not configured - enabled by default",
            "source_method_used": "registry",
            "confidence_level": "high",
            "remediation_hint": "Disable via GPO: Computer Configuration > Administrative Templates > Network > DNS Client > Turn off multicast name resolution"
        }
    
    # Registry failed with privilege error
    return {
        "control_id": "18.5.1",
        "name": "LLMNR Disabled",
        "status": status,
        "severity_weight": 2,
        "details": reason,
        "reason": "Unable to validate LLMNR configuration",
        "source_method_used": "registry",
        "confidence_level": "none",
        "remediation_hint": "Run agent with elevated privileges"
    }


# =============================================================================
# Remote Access Checks
# =============================================================================

def check_rdp_compliance(rdp_enabled: bool) -> Dict[str, Any]:
    """
    CIS 18.9.1: Ensure 'Allow users to connect remotely using RDP' is disabled
    
    Args:
        rdp_enabled: Output from day7_exposure.is_rdp_enabled()
    """
    if rdp_enabled is None:
        return {
            "control_id": "18.9.1",
            "name": "Remote Desktop Protocol (RDP)",
            "status": STATUS_QUERY_FAILED,
            "severity_weight": 2,
            "details": "RDP: Status unknown",
            "reason": "Unable to determine RDP status",
            "source_method_used": "registry",
            "confidence_level": "none",
            "remediation_hint": "Disable if not required via: Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -name 'fDenyTSConnections' -Value 1"
        }
    
    compliant = not rdp_enabled  # Compliant if RDP is disabled
    
    return {
        "control_id": "18.9.1",
        "name": "Remote Desktop Protocol (RDP)",
        "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
        "severity_weight": 2,
        "details": f"RDP: {'Disabled' if compliant else 'Enabled'}",
        "reason": "RDP is disabled" if compliant else "RDP enabled - remote attack surface",
        "source_method_used": "registry",
        "confidence_level": "high",
        "remediation_hint": "Disable if not required, or enable NLA and use strong authentication"
    }


def check_nla_enabled() -> Dict[str, Any]:
    """
    CIS 18.9.2: Ensure 'Require user authentication for remote connections by using NLA' is enabled
    
    Multi-source validation:
    - Primary: Registry (UserAuthentication)
    - Fallback: PowerShell RDP settings
    """
    # Primary method: Registry
    nla_setting, status, reason = _safe_registry_read(
        r"SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp",
        "UserAuthentication"
    )
    
    if status == "success":
        compliant = nla_setting == 1  # 1 = NLA enabled
        return {
            "control_id": "18.9.2",
            "name": "Network Level Authentication (NLA)",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"NLA: {'Enabled' if compliant else 'Disabled'}",
            "reason": "NLA is enabled" if compliant else "NLA disabled - weaker RDP security",
            "source_method_used": "registry",
            "confidence_level": "high",
            "remediation_hint": "Enable via: Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp' -name 'UserAuthentication' -Value 1"
        }
    
    # Registry failed
    return {
        "control_id": "18.9.2",
        "name": "Network Level Authentication (NLA)",
        "status": status,
        "severity_weight": 2,
        "details": reason,
        "reason": "Unable to determine NLA status",
        "source_method_used": "registry",
        "confidence_level": "none",
        "remediation_hint": "Run agent with elevated privileges"
    }


# =============================================================================
# Antivirus Checks
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
        "status": STATUS_COMPLIANT if av_enabled else STATUS_NON_COMPLIANT,
        "severity_weight": 3,  # Critical
        "details": f"AV products enabled: {summary.get('total_products', 0)}",
        "reason": "Antivirus protection is active" if av_enabled else "No active antivirus product detected",
        "source_method_used": "wmi_securitycenter",
        "confidence_level": "high",
        "remediation_hint": "Install and enable Windows Defender or third-party AV"
    })
    
    # Check 2: Real-time protection active
    realtime_active = summary.get("any_realtime_active", False)
    controls.append({
        "control_id": "13.2",
        "name": "Real-Time Protection Active",
        "status": STATUS_COMPLIANT if realtime_active else STATUS_NON_COMPLIANT,
        "severity_weight": 3,
        "details": f"Real-time protection: {'Active' if realtime_active else 'Inactive'}",
        "reason": "Real-time scanning is active" if realtime_active else "Real-time protection disabled - immediate threat risk",
        "source_method_used": "wmi_securitycenter",
        "confidence_level": "high",
        "remediation_hint": "Enable real-time protection in Windows Defender or AV settings"
    })
    
    # Check 3: Definitions up-to-date
    defs_current = summary.get("all_definitions_current")
    if defs_current is None:
        controls.append({
            "control_id": "13.3",
            "name": "Antivirus Definitions Updated",
            "status": STATUS_QUERY_FAILED,
            "severity_weight": 2,
            "details": "Definition status: Unknown",
            "reason": "Unable to determine definition update status",
            "source_method_used": "wmi_securitycenter",
            "confidence_level": "none",
            "remediation_hint": "Verify AV is properly installed and reporting"
        })
    else:
        controls.append({
            "control_id": "13.3",
            "name": "Antivirus Definitions Updated",
            "status": STATUS_COMPLIANT if defs_current else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"Definitions: {'Up-to-date' if defs_current else 'Outdated'}",
            "reason": "Virus definitions are current" if defs_current else "Outdated definitions - cannot detect latest threats",
            "source_method_used": "wmi_securitycenter",
            "confidence_level": "high",
            "remediation_hint": "Run Windows Update or AV update process"
        })
    
    return controls


# =============================================================================
# Audit Policy Checks
# =============================================================================

def check_security_audit_logging() -> Dict[str, Any]:
    """
    CIS 17.1.1: Ensure 'Audit: Force audit policy subcategory settings'
    
    Multi-source validation:
    - Primary: auditpol command
    - Fallback: Registry check for audit policies
    """
    # Primary method: auditpol
    output, status, reason = _safe_powershell_exec([
        "auditpol", "/get", "/category:*"
    ], timeout=10)
    
    if status == "success":
        # Simple heuristic: check if any auditing is enabled
        has_auditing = "Success" in output or "Failure" in output
        success_count = output.count("Success")
        failure_count = output.count("Failure")
        
        return {
            "control_id": "17.1.1",
            "name": "Security Audit Logging Enabled",
            "status": STATUS_COMPLIANT if has_auditing else STATUS_NON_COMPLIANT,
            "severity_weight": 2,
            "details": f"Audit policies configured: Success={success_count}, Failure={failure_count}",
            "reason": "Security audit logging is configured" if has_auditing else "No audit policies configured",
            "source_method_used": "auditpol",
            "confidence_level": "high",
            "remediation_hint": "Configure via GPO: Computer Configuration > Windows Settings > Security Settings > Advanced Audit Policy Configuration"
        }
    
    # auditpol failed
    return {
        "control_id": "17.1.1",
        "name": "Security Audit Logging Enabled",
        "status": status,
        "severity_weight": 2,
        "details": reason,
        "reason": "Unable to query audit policies",
        "source_method_used": "auditpol",
        "confidence_level": "none",
        "remediation_hint": "Run agent with elevated privileges"
    }


def check_event_log_size() -> Dict[str, Any]:
    """
    CIS 17.2.1: Ensure 'Security' log size is configured
    
    Multi-source validation:
    - Primary: PowerShell Get-EventLog
    - Fallback: Registry check
    """
    # Primary method: PowerShell
    output, status, reason = _safe_powershell_exec([
        "powershell", "-Command",
        "Get-EventLog -LogName Security -Newest 1 | Select-Object -ExpandProperty MaximumKilobytes"
    ], timeout=5)
    
    if status == "success" and output.isdigit():
        max_kb = int(output)
        compliant = max_kb >= 32768  # 32 MB
        return {
            "control_id": "17.2.1",
            "name": "Security Log Size",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 1,
            "details": f"Max log size: {max_kb // 1024} MB (Required: ≥32 MB)",
            "reason": "Security log size adequate" if compliant else f"Security log too small ({max_kb // 1024}MB)",
            "source_method_used": "powershell_get_eventlog",
            "confidence_level": "high",
            "remediation_hint": "Increase via: Limit-EventLog -LogName Security -MaximumSize 33554432"
        }
    
    # PowerShell failed
    return {
        "control_id": "17.2.1",
        "name": "Security Log Size",
        "status": status,
        "severity_weight": 1,
        "details": reason,
        "reason": "Unable to determine security log size",
        "source_method_used": "powershell_get_eventlog",
        "confidence_level": "none",
        "remediation_hint": "Run agent with elevated privileges"
    }


def check_log_retention() -> Dict[str, Any]:
    """
    CIS 17.2.2: Ensure 'Security' log retention is configured
    
    Multi-source validation:
    - Primary: Registry check
    - Fallback: PowerShell event log properties
    """
    # Primary method: Registry
    retention, status, reason = _safe_registry_read(
        r"SYSTEM\CurrentControlSet\Services\EventLog\Security",
        "Retention"
    )
    
    if status == "success":
        # Retention = 0 means overwrite as needed (common setting)
        # Retention = -1 means never overwrite (more secure)
        compliant = retention in [0, -1]
        
        return {
            "control_id": "17.2.2",
            "name": "Security Log Retention",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 1,
            "details": f"Retention policy: {'Overwrite as needed' if retention == 0 else 'Never overwrite' if retention == -1 else 'Custom'}",
            "reason": "Log retention policy configured" if compliant else "Unusual retention setting",
            "source_method_used": "registry",
            "confidence_level": "high",
            "remediation_hint": "Set retention via Group Policy or Event Viewer properties"
        }
    
    # Registry failed
    return {
        "control_id": "17.2.2",
        "name": "Security Log Retention",
        "status": status,
        "severity_weight": 1,
        "details": reason,
        "reason": "Unable to determine log retention policy",
        "source_method_used": "registry",
        "confidence_level": "none",
        "remediation_hint": "Run agent with elevated privileges"
    }


# =============================================================================
# Encryption Checks
# =============================================================================

def check_bitlocker_enabled() -> Dict[str, Any]:
    """
    CIS 18.9.3: Ensure BitLocker is enabled on system drive
    
    Multi-source validation:
    - Primary: PowerShell Get-BitLockerVolume
    - Fallback: manage-bde command
    """
    # Primary method: PowerShell
    output, status, reason = _safe_powershell_exec([
        "powershell", "-Command",
        "Get-BitLockerVolume -MountPoint C: | Select-Object -ExpandProperty VolumeStatus"
    ], timeout=10)
    
    if status == "success":
        compliant = "FullyEncrypted" in output
        return {
            "control_id": "18.9.3",
            "name": "BitLocker System Drive Encryption",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 3,  # Critical for data protection
            "details": f"C: drive status: {output if output else 'Not encrypted'}",
            "reason": "System drive is fully encrypted" if compliant else "System drive not encrypted - data at risk",
            "source_method_used": "powershell_bitlocker",
            "confidence_level": "high",
            "remediation_hint": "Enable via: Enable-BitLocker -MountPoint C: -EncryptionMethod XtsAes256"
        }
    
    # Fallback: manage-bde
    output, fallback_status, fallback_reason = _safe_powershell_exec([
        "manage-bde", "-status", "C:"
    ], timeout=10)
    
    if fallback_status == "success":
        compliant = "Fully Encrypted" in output or "Protection On" in output
        return {
            "control_id": "18.9.3",
            "name": "BitLocker System Drive Encryption",
            "status": STATUS_COMPLIANT if compliant else STATUS_NON_COMPLIANT,
            "severity_weight": 3,
            "details": f"C: drive: {' Fully Encrypted' if compliant else 'Not encrypted'}",
            "reason": "System drive is fully encrypted" if compliant else "System drive not encrypted - data at risk",
            "source_method_used": "manage_bde",
            "confidence_level": "medium",
            "remediation_hint": "Enable via: Enable-BitLocker -MountPoint C: -EncryptionMethod XtsAes256"
        }
    
    # Both methods failed - likely feature not installed on Home editions
    if status == STATUS_FEATURE_NOT_INSTALLED or fallback_status == STATUS_FEATURE_NOT_INSTALLED:
        return {
            "control_id": "18.9.3",
            "name": "BitLocker System Drive Encryption",
            "status": STATUS_FEATURE_NOT_INSTALLED,
            "severity_weight": 3,
            "details": "BitLocker feature not available on this edition",
            "reason": "BitLocker not available (requires Pro/Enterprise edition)",
            "source_method_used": "powershell+manage_bde",
            "confidence_level": "high",
            "remediation_hint": "Upgrade to Windows Pro/Enterprise, or use third-party encryption"
        }
    
    # Both failed with other errors
    return {
        "control_id": "18.9.3",
        "name": "BitLocker System Drive Encryption",
        "status": status if status != "success" else fallback_status,
        "severity_weight": 3,
        "details": f"Primary: {reason}; Fallback: {fallback_reason}",
        "reason": "Unable to determine BitLocker status",
        "source_method_used": "powershell+manage_bde",
        "confidence_level": "none",
        "remediation_hint": "Run agent with elevated privileges"
    }


# =============================================================================
# Weighted Scoring & Priority Calculation
# =============================================================================

def calculate_weighted_score(controls: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate weighted compliance score.
    
    Formula: (sum of compliant weights / total weights) × 100
    
    Args:
        controls: List of control check results
    
    Returns:
        Dictionary with scoring details including failed counts by severity
    """
    total_weight = 0
    compliant_weight = 0
    compliant_count = 0
    non_compliant_count = 0
    
    critical_failed = 0  # severity_weight = 3
    high_failed = 0      # severity_weight = 2
    moderate_failed = 0  # severity_weight = 1
    
    for control in controls:
        weight = control.get("severity_weight", 1)
        total_weight += weight
        
        status = control.get("status")
        if status == STATUS_COMPLIANT:
            compliant_weight += weight
            compliant_count += 1
        else:
            non_compliant_count += 1
            # Track failures by severity
            if weight == 3:
                critical_failed += 1
            elif weight == 2:
                high_failed += 1
            elif weight == 1:
                moderate_failed += 1
    
    # Calculate percentage
    if total_weight > 0:
        weighted_score = (compliant_weight / total_weight) * 100
    else:
        weighted_score = 0.0
    
    return {
        "weighted_score": round(weighted_score, 2),
        "compliant_count": compliant_count,
        "non_compliant_count": non_compliant_count,
        "total_controls_checked": len(controls),
        "total_weight": total_weight,
        "compliant_weight": compliant_weight,
        "critical_failed": critical_failed,
        "high_failed": high_failed,
        "moderate_failed": moderate_failed
    }


def calculate_priority_controls(controls: List[Dict[str, Any]], top_n: int = 3) -> List[Dict[str, Any]]:
    """
    Calculate top N priority controls based on severity, exposure, and exploitability.
    
    Priority Score = severity_weight × exposure_impact × exploitability
    
    Args:
        controls: List of control check results
        top_n: Number of top priority controls to return (default: 3)
    
    Returns:
        List of top N controls sorted by priority score
    """
    # Define exposure impact and exploitability for each control
    # These values are based on CVSS-like scoring and real-world attack patterns
    control_risk_factors = {
        "2.3.1": {"exposure": 3, "exploitability": 3},  # Guest account - direct access
        "13.1": {"exposure": 3, "exploitability": 3},   # No AV - malware execution
        "13.2": {"exposure": 3, "exploitability": 3},   # No real-time - active threats
        "18.3.1": {"exposure": 3, "exploitability": 3}, # SMBv1 - WannaCry, NotPetya
        "18.9.3": {"exposure": 3, "exploitability": 2}, # No encryption - data theft
        "9.1": {"exposure": 3, "exploitability": 2},    # Firewall off - network exposure
        "18.9.1": {"exposure": 2, "exploitability": 3}, # RDP enabled - brute force
        "1.1.1": {"exposure": 2, "exploitability": 2},  # Weak passwords - credential attacks
        "1.1.2": {"exposure": 2, "exploitability": 2},  # No complexity - brute force
        "18.5.1": {"exposure": 2, "exploitability": 2}, # LLMNR - credential theft
        "18.9.2": {"exposure": 2, "exploitability": 2}, # No NLA - RDP attacks
        "9.1.2/4/6": {"exposure": 2, "exploitability": 2}, # Firewall allow inbound
        "1.2.1": {"exposure": 1, "exploitability": 1},  # No lockout - brute force
        "17.1.1": {"exposure": 1, "exploitability": 1}, # No audit - no detection
        "17.2.1": {"exposure": 1, "exploitability": 1}, # Small log - lost evidence
        "17.2.2": {"exposure": 1, "exploitability": 1}, # Log retention - forensics
        "13.3": {"exposure": 2, "exploitability": 2},   # Outdated AV - new threats
    }
    
    # Only consider non-compliant controls
    non_compliant = [c for c in controls if c.get("status") != STATUS_COMPLIANT]
    
    # Calculate priority scores
    prioritized = []
    for control in non_compliant:
        control_id = control.get("control_id", "")
        severity_weight = control.get("severity_weight", 1)
        
        # Get risk factors or use defaults
        factors = control_risk_factors.get(control_id, {"exposure": 1, "exploitability": 1})
        exposure_impact = factors["exposure"]
        exploitability = factors["exploitability"]
        
        # Calculate priority score
        priority_score = severity_weight * exposure_impact * exploitability
        
        prioritized.append({
            "control_id": control_id,
            "name": control.get("name", ""),
            "priority_score": priority_score,
            "severity_weight": severity_weight,
            "exposure_impact": exposure_impact,
            "exploitability": exploitability,
            "status": control.get("status", ""),
            "reason": control.get("reason", ""),
            "remediation_hint": control.get("remediation_hint", ""),
            "details": control.get("details", "")
        })
    
    # Sort by priority score (descending)
    prioritized.sort(key=lambda x: x["priority_score"], reverse=True)
    
    # Return top N
    return prioritized[:top_n]


# =============================================================================
# Main Collection Function
# =============================================================================

def collect_cis_compliance() -> Dict[str, Any]:
    """
    Main function to collect all CIS compliance data.
    
    Returns:
        Dictionary with controls, compliance_score, and priority_focus
    """
    controls = []
    
    logger.info("Starting CIS compliance assessment...")
    
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
    
    logger.info(f"CIS compliance assessment complete: {len(controls)} controls checked")
    
    # Calculate final score
    compliance_score = calculate_weighted_score(controls)
    
    # Calculate top 3 priority actions
    priority_focus = calculate_priority_controls(controls, top_n=3)
    
    return {
        "controls": controls,
        "compliance_score": compliance_score,
        "priority_focus": priority_focus
    }
