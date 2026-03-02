import ctypes
import winreg


import subprocess
import logging

logger = logging.getLogger(__name__)

def get_execution_privilege():
    """
    Checks if the current process is running elevated (as Administrator).
    Looks for the well-known SID S-1-5-32-544 (Administrators group).
    """
    try:
        output = subprocess.check_output(
            ["whoami", "/groups"], 
            text=True, 
            timeout=5,
            stderr=subprocess.DEVNULL
        )
        if "S-1-5-32-544" in output:
            return "elevated"
        return "standard"
    except Exception as e:
        logger.error(f"Failed to determine execution privilege: {e}")
        return "unknown"

def get_user_account_role():
    """
    Checks the actual user account's local group membership.
    Determines if the user inherently belongs to the Administrators group.
    """
    try:
        # Get Current User Name
        whoami_output = subprocess.check_output(
            ["whoami"], 
            text=True, 
            timeout=5,
            stderr=subprocess.DEVNULL
        ).strip()
        
        # Output format is usually DOMAIN\Username
        parts = whoami_output.split("\\")
        if len(parts) == 2:
            username = parts[1]
        else:
            username = whoami_output

        # Get User's Local Group Memberships
        net_user_output = subprocess.check_output(
            ["net", "user", username], 
            text=True, 
            timeout=5,
            stderr=subprocess.DEVNULL
        )

        # Parse local groups
        for line in net_user_output.splitlines():
            if line.startswith("Local Group Memberships"):
                if "*Administrators" in line:
                    return "local_admin"
                else:
                    return "user_standard"
        return "user_standard"
    except Exception as e:
        logger.error(f"Failed to determine user account role: {e}")
        return "unknown"


# Controls whether User Account Control is enforced.
# If disabled, every process runs effectively elevated.
def is_uac_enabled():
    try:
        key=winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System")

        value, _=winreg.QueryValueEx(key, "EnableLUA")

        return value==1
    except:
        return None
    

def collect_privilege_posture():
    data = {
        "execution_privilege": "unknown",
        "user_account_role": "unknown",
        "uac_enabled": None,
        "confidence": "high",
        "evidence": [],
        "errors": []
    }

    # Track distinct execution elevation
    exec_priv = get_execution_privilege()
    data["execution_privilege"] = exec_priv
    if exec_priv == "unknown":
        data["confidence"] = "medium"
        data["errors"].append("Unable to determine execution elevation.")
    else:
        data["evidence"].append(f"Execution Privilege: {exec_priv}")

    # Track user role
    user_role = get_user_account_role()
    data["user_account_role"] = user_role
    if user_role == "unknown":
        if data["confidence"] != "medium":
            data["confidence"] = "medium"
        data["errors"].append("Unable to determine local user account role.")
    else:
        data["evidence"].append(f"User Account Role: {user_role}")

    # Track UAC
    uac = is_uac_enabled()
    if uac is not None:
        data["uac_enabled"] = uac
        data["evidence"].append("Read EnableLUA from registry")
    else:
        if data["confidence"] != "medium":
            data["confidence"] = "medium"
        data["errors"].append("Unable to read UAC configuration from Registry")

    return data