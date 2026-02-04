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
    }
}
