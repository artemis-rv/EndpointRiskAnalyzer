"""
remediation_data.py

Static metadata dictionary storing Remediation hints for specific CIS controls.
Provides contextual help on HOW to fix failing compliance checks.
"""

REMEDIATION_STRATEGIES = {
    # Password Policies
    "1.1.1": {
        "description": "Ensure 'Enforce password history' is set to '24 or more password(s)'.",
        "why_it_matters": "Prevents users from constantly reusing the same weak passwords over time.",
        "manual_fix_command": "secpol.msc -> Security Settings -> Account Policies -> Password Policy -> Enforce password history -> Set to 24",
        "expected_secure_state": "24 passwords remembered"
    },
    "1.1.2": {
        "description": "Ensure 'Maximum password age' is set to '365 or fewer days, but not 0'.",
        "why_it_matters": "Forces periodic password rotation in case credentials have been silently compromised.",
        "manual_fix_command": "secpol.msc -> Security Settings -> Account Policies -> Password Policy -> Maximum password age -> Set to 90",
        "expected_secure_state": "<= 365 Days"
    },
    "1.1.3": {
        "description": "Ensure 'Minimum password age' is set to '1 or more day(s)'.",
        "why_it_matters": "Prevents users from bypassing the password history policy by immediately changing their password 24 times in a row.",
        "manual_fix_command": "secpol.msc -> Security Settings -> Account Policies -> Password Policy -> Minimum password age -> Set to 1",
        "expected_secure_state": ">= 1 Day"
    },
    "1.1.4": {
        "description": "Ensure 'Minimum password length' is set to '14 or more character(s)'.",
        "why_it_matters": "Longer passwords exponentially increase the time required for brute-force attacks.",
        "manual_fix_command": "secpol.msc -> Security Settings -> Account Policies -> Password Policy -> Minimum password length -> Set to 14",
        "expected_secure_state": ">= 14 Characters"
    },
    "1.1.5": {
        "description": "Ensure 'Password must meet complexity requirements' is set to 'Enabled'.",
        "why_it_matters": "Requires uppercase, lowercase, numbers, and symbols, eliminating weak common passwords.",
        "manual_fix_command": "secpol.msc -> Security Settings -> Account Policies -> Password Policy -> Password must meet complexity requirements -> Enable",
        "expected_secure_state": "Enabled"
    },

    # Account Lockout
    "1.2.1": {
        "description": "Ensure 'Account lockout duration' is set to '15 or more minute(s)'.",
        "why_it_matters": "Disables an account for a set period if brute force is detected, halting automated attacks.",
        "manual_fix_command": "secpol.msc -> Security Settings -> Account Policies -> Account Lockout Policy -> Account lockout duration -> Set to 15",
        "expected_secure_state": ">= 15 Minutes"
    },
    "1.2.2": {
        "description": "Ensure 'Account lockout threshold' is set to '5 or fewer invalid logon attempt(s)'.",
        "why_it_matters": "Determines how many failed attempts are permitted before triggering the lockout mechanism.",
        "manual_fix_command": "secpol.msc -> Security Settings -> Account Policies -> Account Lockout Policy -> Account lockout threshold -> Set to 5",
        "expected_secure_state": "<= 5 Attempts"
    },

    # User Rights
    "2.2.14": {
        "description": "Ensure 'Log on as a service' denies standard users.",
        "why_it_matters": "Allows an account to run background services. Standard users with this privilege can easily escalate privileges.",
        "manual_fix_command": "secpol.msc -> User Rights Assignment -> Log on as a service -> Remove unauthorized accounts",
        "expected_secure_state": "Administrators/Service Accounts Only"
    },
    "2.2.33": {
        "description": "Ensure Guest account is explicitly disabled.",
        "why_it_matters": "The built-in Guest account allows anonymous access without a password. It's a massive entry vector.",
        "manual_fix_command": "Right click Start -> Computer Management -> Local Users and Groups -> Users -> Guest -> Properties -> Account is disabled",
        "expected_secure_state": "Disabled"
    },

    # Firewalls & General Network
    "9.1.1": {
        "description": "Ensure Windows Firewall: Domain Profile is 'On'.",
        "why_it_matters": "Protects endpoints while connected to the corporate domain network by isolating unsolicited traffic.",
        "manual_fix_command": "wf.msc -> Windows Defender Firewall Properties -> Domain Profile -> Firewall state -> On",
        "expected_secure_state": "Firewall State = On"
    },
    "9.2.1": {
        "description": "Ensure Windows Firewall: Private Profile is 'On'.",
        "why_it_matters": "Protects endpoints on trusted non-domain networks (like secure home wifi).",
        "manual_fix_command": "wf.msc -> Windows Defender Firewall Properties -> Private Profile -> Firewall state -> On",
        "expected_secure_state": "Firewall State = On"
    },
    "9.3.1": {
        "description": "Ensure Windows Firewall: Public Profile is 'On'.",
        "why_it_matters": "Vital protection blocking all incoming traffic when connected to unreliable networks like airport WiFi.",
        "manual_fix_command": "wf.msc -> Windows Defender Firewall Properties -> Public Profile -> Firewall state -> On",
        "expected_secure_state": "Firewall State = On"
    },

    # Antivirus / Defender
    "18.9.1": {
        "description": "Ensure 'Turn off Microsoft Defender Antivirus' is set to 'Disabled'.",
        "why_it_matters": "Ensures the built-in antivirus engine is actively monitoring, protecting, and remediating malware payloads.",
        "manual_fix_command": "gpedit.msc -> Computer Configuration -> Administrative Templates -> Windows Components -> Microsoft Defender Antivirus -> Turn off Microsoft Defender -> Set to Disabled",
        "expected_secure_state": "Disabled (AV ON)"
    },
    
    # RDP
    "18.9.72.1": {
        "description": "Ensure 'Do not allow passwords to be saved' is set to 'Enabled' for Remote Desktop.",
        "why_it_matters": "Prevents users from caching their credentials in RDP clients, which attackers can quickly extract using Mimikatz.",
        "manual_fix_command": "gpedit.msc -> Windows Components -> Remote Desktop Services -> Remote Desktop Connection Client -> Do not allow passwords to be saved -> Enabled",
        "expected_secure_state": "Enabled"
    }
}

def get_remediation_for_control(control_id: str) -> dict:
    """
    Lookup a specific remediation strategy by CIS control ID.
    Returns the metadata dict, or a generic fallback if undocumented.
    """
    return REMEDIATION_STRATEGIES.get(str(control_id), {
        "description": f"CIS Baseline control {control_id} violated.",
        "why_it_matters": "Unsecured configuration allowing deviation from Organizational benchmarks.",
        "manual_fix_command": "Review organization documentation or GPO policies.",
        "expected_secure_state": "Compliant"
    })
