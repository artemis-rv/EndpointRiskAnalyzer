"""
interpretation_rules.py

This file defines human-readable interpretation rules for
organization-level posture findings.

IMPORTANT:
- This file does NOT perform any analysis.
- It does NOT read files or process JSON.
- It only maps findings to explanatory text.

The goal is to ensure interpretation logic is:
- Explicit
- Deterministic
- Review-safe
"""

# -------------------------------
# Generic interpretation helpers
# -------------------------------

def systemic_statement(base_text: str) -> str:
    """
    Wraps a statement to indicate that the finding
    represents an organization-wide (systemic) pattern.
    """
    return f"{base_text} This appears to be a standard or normalized configuration across the organization."


def isolated_statement(base_text: str) -> str:
    """
    Wraps a statement to indicate that the finding
    is isolated and not representative of the entire organization.
    """
    return f"{base_text} This does not represent an organization-wide pattern."


# -------------------------------
# Issue-specific interpretations
# -------------------------------

ISSUE_INTERPRETATIONS = {

    "firewall_disabled": {
        "systemic": lambda: systemic_statement(
            "Firewall disabled status is commonly observed."
        ),
        "isolated": lambda: isolated_statement(
            "Firewall disabled status is observed on a limited number of endpoints."
        )
    },

    "antivirus_not_confirmed": {
        "systemic": lambda: systemic_statement(
            "Antivirus status could not be confirmed on the majority of endpoints."
        ),
        "isolated": lambda: isolated_statement(
            "Antivirus status could not be confirmed on a small subset of endpoints."
        )
    },

    "admin_user": {
        "systemic": lambda: systemic_statement(
            "Administrative privileges are commonly assigned across endpoints."
        ),
        "isolated": lambda: isolated_statement(
            "Administrative privileges are present on a limited number of endpoints."
        )
    },

    "uac_disabled": {
        "systemic": lambda: systemic_statement(
            "User Account Control (UAC) is disabled across many endpoints."
        ),
        "isolated": lambda: isolated_statement(
            "User Account Control (UAC) is disabled on a small number of endpoints."
        )
    },

    "rdp_enabled": {
        "systemic": lambda: systemic_statement(
            "Remote Desktop Protocol (RDP) is enabled on the majority of endpoints."
        ),
        "isolated": lambda: isolated_statement(
            "Remote Desktop Protocol (RDP) is enabled on a limited number of endpoints."
        )
    },

    "smbv1_enabled": {
        "systemic": lambda: systemic_statement(
            "SMBv1 is enabled across many endpoints."
        ),
        "isolated": lambda: isolated_statement(
            "SMBv1 is enabled on a limited number of endpoints."
        )
    },

    "winrm_enabled": {
        "systemic": lambda: systemic_statement(
            "Windows Remote Management (WinRM) is enabled across a majority of endpoints."
        ),
        "isolated": lambda: isolated_statement(
            "Windows Remote Management (WinRM) is enabled on a limited number of endpoints."
        )
    },

    "risky_ports_exposed": {
        "systemic": lambda: systemic_statement(
            "Common service ports are listening across many endpoints."
        ),
        "isolated": lambda: isolated_statement(
            "Listening services on common ports are observed on a limited number of endpoints."
        )
    },

    # -------------------------------
    # CIS Compliance Interpretations
    # -------------------------------

    "cis_low_compliance": {
        "systemic": lambda: systemic_statement(
            "CIS Benchmark compliance scores below 70% are common across the organization. This indicates widespread configuration gaps against industry security standards."
        ),
        "isolated": lambda: isolated_statement(
            "CIS Benchmark compliance scores below 70% are observed on select endpoints."
        )
    },

    "cis_critical_failures": {
        "systemic": lambda: systemic_statement(
            "Critical CIS control failures (severity weight 3) are widespread. Immediate attention required for high-impact security controls like Guest Account, BitLocker, Firewall, and Antivirus."
        ),
        "isolated": lambda: isolated_statement(
            "Critical CIS control failures detected on a limited number of endpoints."
        )
    },

    "cis_guest_account_enabled": {
        "systemic": lambda: systemic_statement(
            "CIS 2.3.1: Guest account is enabled across many endpoints. This represents a significant unauthorized access risk."
        ),
        "isolated": lambda: isolated_statement(
            "CIS 2.3.1: Guest account is enabled on a limited number of endpoints."
        )
    },

    "cis_bitlocker_disabled": {
        "systemic": lambda: systemic_statement(
            "CIS 18.9.3: BitLocker encryption is not enabled on system drives across the organization. Data-at-rest protection is insufficient."
        ),
        "isolated": lambda: isolated_statement(
            "CIS 18.9.3: BitLocker encryption is not enabled on select endpoints."
        )
    },

    "cis_smbv1_enabled": {
        "systemic": lambda: systemic_statement(
            "CIS 18.3.1: SMBv1 protocol remains enabled across many endpoints despite known critical vulnerabilities (WannaCry, NotPetya)."
        ),
        "isolated": lambda: isolated_statement(
            "CIS 18.3.1: SMBv1 protocol is enabled on a limited number of endpoints."
        )
    },

    "cis_weak_password_policy": {
        "systemic": lambda: systemic_statement(
            "CIS 1.1.1: Minimum password length requirements (14+ characters) are not enforced across the organization."
        ),
        "isolated": lambda: isolated_statement(
            "CIS 1.1.1: Minimum password length requirements are not met on select endpoints."
        )
    },

    "cis_rdp_enabled": {
        "systemic": lambda: systemic_statement(
            "CIS 18.9.1: Remote Desktop Protocol (RDP) is enabled on the majority of endpoints, increasing remote attack surface."
        ),
        "isolated": lambda: isolated_statement(
            "CIS 18.9.1: Remote Desktop Protocol (RDP) is enabled on a limited number of endpoints."
        )
    }
}
