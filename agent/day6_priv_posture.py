import ctypes
import winreg


#Checks whether the current process token has admin privileges.
#Can this user install software or alter system state?”
def is_user_admin():            
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()    
    except:
        return None
    
print(is_user_admin())


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
        "user_is_admin": None,
        "uac_enabled": None,
        "confidence": "high",
        "evidence": [],
        "errors": []
    }

    admin_status = is_user_admin()
    if admin_status is not None:
        data["user_is_admin"] = admin_status
        data["evidence"].append("Checked admin token via Windows API")
    else:
        data["confidence"] = "medium"
        data["errors"].append("Unable to determine admin status")

    uac = is_uac_enabled()
    if uac is not None:
        data["uac_enabled"] = uac
        data["evidence"].append("Read EnableLUA from registry")
    else:
        data["confidence"] = "medium"
        data["errors"].append("Unable to read UAC configuration")

    return data