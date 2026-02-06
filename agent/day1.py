import platform         #information about OS
import socket

import winreg           #windows registry

import subprocess       #interact with powershell

# import json

from datetime import datetime


#function to collect basic system identification info.
#identifies which machine is sending the data
def get_system_info():
    return{
        "hostname": socket.gethostname(),           #use: to detect duplicates and track assets
        "os": platform.system(),                    #use: patch and security rules
        "os_version": platform.version(),           #use: risk scoring
        "os_release": platform.release()            
    }

# print(get_system_info())
# print()
# get_system_info()



def get_installed_software():       #winreg
    #Reads Window Registry to extract installed software names and versions

    software_list=[]

    registry_paths=[
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    ]

    for path in registry_paths:
        try:
            #Opening the registry at the path location in the HKLM with a handler
            registry_key=winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path)

            #returns a 3-tuple (subkey_counts, value_counts, last_mod_time)
            num_subkeys=winreg.QueryInfoKey(registry_key)[0]
            
            for i in range(num_subkeys):
                try:
                    #returns the name of the subkey present at index i
                    subkey_name=winreg.EnumKey(registry_key,i)

                    #opens a handle at the subkey name
                    subkey = winreg.OpenKey(registry_key, subkey_name)

                    name=winreg.QueryValueEx(subkey, "DisplayName")[0]

                    try:
                        version=winreg.QueryValueEx(subkey, "DisplayVersion")[0]
                    except FileNotFoundError:
                        version="Unknown"

                    software_list.append({"name": name, "version":version})

                except FileNotFoundError:
                    continue

        except PermissionError:
            continue

    return software_list
    

# installed_softwares=get_installed_software()
# for sw in installed_softwares:
#     print(sw)


def get_defender_status():      #powershell
    #checks whether Windows defender real time protection is active or not
    #using subprocess python asks the powershell to check the status/run the program or a command
    #USE: feed to ML models

    try:
        #list is passed to prevent shell injection 
        #"-Command" is used to exit safely without hanging
        command=["powershell","-Command","Get-MpComputerStatus | Select-Object -ExpandProperty RealTimeProtectionEnabled"]    

        """🔹 The pipe |
            This means:
            “Take the output of the left command and pass it to the next one.”
            This is object piping, not text piping."""

        """🔹 Select-Object -ExpandProperty RealTimeProtectionEnabled
            This does two things:
            Selects only the RealTimeProtectionEnabled property
            -ExpandProperty extracts the raw value, not an object wrapper"""

        output=subprocess.check_output(command, text=True).strip()      #removes escape characters

        return{"realtime_protection": output}
    
    except subprocess.CalledProcessError:
        return{"realtime_protection": "Unknown"}
    

# print(get_defender_status())
# print()


def get_firewall_status():      #netsh
    """
    Checks Windows Firewall status for all profiles
    (Domain, Private, Public) using netsh.
    """

    try:
        output=subprocess.check_output(["netsh", "advfirewall", "show", "allprofiles"], text=True)

        firewall_status={}

        current_profile=None            #3 profiles: public, private, domain

        for line in output.splitlines():
            line=line.strip()

            if "Domain Profile Settings" in line:
                current_profile = "Domain"
            elif "Private Profile Settings" in line:
                current_profile = "Private"
            elif "Public Profile Settings" in line:
                current_profile = "Public"

            elif "State" in line and current_profile:
                if "ON" in line:
                    firewall_status[current_profile] = "ON"
                elif "OFF" in line:
                    firewall_status[current_profile] = "OFF"

        return firewall_status
    except Exception as e:
        return{"Error": str(e)}


# print(get_firewall_status())



#evaluating basic risk flags
def evaluate_basic_risk_flags(scan):
    flags=[]

    defender=scan["security"]["defender"].get("realtime_protection")
    firewall=scan["security"]["firewall"]
    software=len(scan["installed_softwares"])
    # software=scan["installed_softwares"]

    if defender == "False":
        flags.append({
            "id": "AV_DISABLED",
            "severity": "HIGH",
            "description": "Antivirus real-time protection is disabled"
        })

    elif defender == "Unknown":
        flags.append({
            "id": "AV_STATUS_UNKNOWN",
            "severity": "MEDIUM",
            "description": "Antivirus status could not be determined"
        })

    if firewall.get("Public") == "OFF":
        flags.append({
            "id": "FIREWALL_PUBLIC_OFF",
            "severity": "HIGH",
            "description": "Firewall is disabled on Public network profile"
        })

    if software > 100:
        flags.append({
            "id": "LARGE_ATTACK_SURFACE",
            "severity": "LOW",
            "description": f"{software} installed applications detected"
        })


    ####DAY 2###
    #python and java runtimes
    if scan["runtimes"]["java"]["present"] is True:
        flags.append({
            "id": "JAVA_PRESENT",
            "severity": "MEDIUM",
            "description": "Java runtime detected; commonly exploited if outdated"
        })
    if scan["runtimes"]["python"]["present"] is True:
        flags.append({
            "id": "PYTHON_PRESENT",
            "severity": "LOW",
            "description": "Python runtime present on system"
        })


    return flags



#day1 Scan

def run_day1_scan():
    scan = {
        "metadata": {
            "scan_time_utc": datetime.now().isoformat() + "Z",
            "agent_version": "1.0"
        },
        "system": get_system_info(),
        "security": {
            "defender": get_defender_status(),
            "firewall": get_firewall_status()
        },
        # "installed_softwares": len(get_installed_software())
        "installed_softwares": get_installed_software()
    }

    # scan["risk_flags"] = evaluate_basic_risk_flags(scan)

    return scan

# print(day1_scan())



# if __name__ == "__main__":
#     scan_result = run_day1_scan()
#     print(json.dumps(scan_result, indent=2))



