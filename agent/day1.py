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
    """
    Layer 1: Registry-based software detection.
    Reads Windows Registry to extract installed software names, versions, publishers, and install locations.
    """

    software_list=[]

    # Registry paths to query (HKLM and HKCU)
    registry_queries = [
        (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Uninstall")
    ]

    for root_key, path in registry_queries:
        try:
            #Opening the registry at the path location with a handler
            registry_key=winreg.OpenKey(root_key, path)

            #returns a 3-tuple (subkey_counts, value_counts, last_mod_time)
            num_subkeys=winreg.QueryInfoKey(registry_key)[0]
            
            for i in range(num_subkeys):
                try:
                    #returns the name of the subkey present at index i
                    subkey_name=winreg.EnumKey(registry_key,i)

                    #opens a handle at the subkey name
                    subkey = winreg.OpenKey(registry_key, subkey_name)

                    try:
                        name=winreg.QueryValueEx(subkey, "DisplayName")[0]
                    except FileNotFoundError:
                        continue  # Skip if no DisplayName

                    try:
                        version=winreg.QueryValueEx(subkey, "DisplayVersion")[0]
                    except FileNotFoundError:
                        version="Unknown"
                    
                    try:
                        publisher=winreg.QueryValueEx(subkey, "Publisher")[0]
                    except FileNotFoundError:
                        publisher="Unknown"
                    
                    try:
                        install_location=winreg.QueryValueEx(subkey, "InstallLocation")[0]
                    except FileNotFoundError:
                        install_location=None

                    software_list.append({
                        "name": name,
                        "version": version,
                        "publisher": publisher,
                        "install_location": install_location,
                        "source": "registry"
                    })

                except FileNotFoundError:
                    continue
                except Exception:
                    continue

        except PermissionError:
            continue
        except Exception:
            continue

    return software_list
    

# installed_softwares=get_installed_software()
# for sw in installed_softwares:
#     print(sw)


def get_running_processes():
    """
    Layer 2: Detection of running processes using psutil.
    Captures process names and executable paths for runtime-only software.
    """
    try:
        import psutil
    except ImportError:
        return []
    
    processes = []
    seen_names = set()
    
    for proc in psutil.process_iter(['name', 'exe']):
        try:
            proc_info = proc.info
            name = proc_info.get('name')
            exe_path = proc_info.get('exe')
            
            if not name or name in seen_names:
                continue
            
            # Skip system processes
            if name.lower() in ['system', 'registry', 'idle', 'csrss.exe', 'smss.exe', 'wininit.exe']:
                continue
            
            processes.append({
                "name": name,
                "executable_path": exe_path,
                "runtime_only": True,
                "source": "process"
            })
            seen_names.add(name)
            
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
        except Exception:
            continue
    
    return processes


def get_windows_services():
    """
    Layer 3: Detection of Windows services using psutil.
    Captures service names, display names, binary paths, and running status.
    """
    try:
        import psutil
    except ImportError:
        return []
    
    services = []
    
    try:
        for service in psutil.win_service_iter():
            try:
                info = service.as_dict()
                services.append({
                    "name": info.get('name'),
                    "display_name": info.get('display_name'),
                    "binary_path": info.get('binpath'),
                    "status": info.get('status'),
                    "background_service": True,
                    "source": "service"
                })
            except Exception:
                continue
    except Exception:
        pass
    
    return services


def build_software_inventory():
    """
    Combines all three layers of software detection with intelligent deduplication.
    Returns comprehensive software inventory with summary counts.
    """
    from pathlib import Path
    
    # Collect data from all three layers
    registry_software = get_installed_software()
    running_processes = get_running_processes()
    services = get_windows_services()
    
    # Deduplication logic
    inventory = []
    seen = set()  # Track normalized names to avoid duplicates
    
    # Helper function to normalize names for comparison
    def normalize_name(name):
        if not name:
            return ""
        return name.lower().replace('.exe', '').replace(' ', '').replace('-', '').replace('_', '')
    
    # Layer 1: Add registry entries (highest priority)
    for sw in registry_software:
        normalized = normalize_name(sw['name'])
        if normalized and normalized not in seen:
            inventory.append(sw)
            seen.add(normalized)
    
    # Layer 2: Add runtime-only processes (not in registry)
    for proc in running_processes:
        # Try to match by executable name
        proc_name = proc['name']
        exe_path = proc.get('executable_path', '')
        
        # Extract base name from path if available
        if exe_path:
            try:
                base_name = Path(exe_path).stem
                normalized = normalize_name(base_name)
            except Exception:
                normalized = normalize_name(proc_name)
        else:
            normalized = normalize_name(proc_name)
        
        if normalized and normalized not in seen:
            inventory.append(proc)
            seen.add(normalized)
    
    # Layer 3: Add services (not in registry or processes)
    for svc in services:
        svc_name = svc.get('name', '')
        display_name = svc.get('display_name', '')
        
        # Try both service name and display name
        normalized_svc = normalize_name(svc_name)
        normalized_display = normalize_name(display_name)
        
        if normalized_svc and normalized_display and normalized_svc not in seen and normalized_display not in seen:
            inventory.append(svc)
            seen.add(normalized_svc)
            seen.add(normalized_display)
    
    # Calculate summary counts
    total_runtime_only = sum(1 for item in inventory if item.get('runtime_only', False))
    total_services = sum(1 for item in inventory if item.get('background_service', False))
    total_registered = len(registry_software)
    
    return {
        "inventory": inventory,
        "counts": {
            "total_registered": total_registered,
            "total_runtime_only": total_runtime_only,
            "total_services": total_services,
            "total_unique": len(inventory)
        }
    }


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


def get_antivirus_posture():
    """
    Queries Windows Security Center via WMI to detect all installed antivirus products.
    Decodes the productState bitmask to extract enabled status, real-time protection,
    and definition update status for each product.
    
    Returns structured JSON with all detected AV products and a summary.
    Falls back to PowerShell-based Defender check if WMI query fails.
    """
    
    try:
        import wmi
        
        # Connect to Security Center namespace
        try:
            c = wmi.WMI(namespace=r"root\SecurityCenter2")
        except Exception as wmi_error:
            # WMI connection failed, fall back to PowerShell
            return _fallback_defender_check(f"WMI connection failed: {str(wmi_error)}")
        
        # Query all AntiVirus products
        av_products = c.AntiVirusProduct()
        
        if not av_products:
            # No antivirus products detected
            return {
                "query_method": "wmi",
                "products": [],
                "summary": {
                    "total_products": 0,
                    "any_enabled": False,
                    "any_realtime_active": False,
                    "all_definitions_current": False
                }
            }
        
        products = []
        any_enabled = False
        any_realtime_active = False
        all_definitions_current = True
        
        for av in av_products:
            product_state = av.productState
            
            # Decode the productState bitmask
            # productState is a hexadecimal value with different regions:
            # Bits 12-15 (0x1000): Product enabled/disabled
            # Bits 8-11 (0x0100): Signature/definition status
            # The exact interpretation can vary, but common patterns:
            # - 0x1000 in bits 12-15 means enabled
            # - 0x1000 in bits 8-11 means definitions up to date
            
            # Extract enabled status (check bit 12-15)
            enabled = bool(product_state & 0x1000)
            
            # Extract definition status (check bits 8-11)
            # 0x1000 in this region typically means up-to-date
            definitions_updated = bool(product_state & 0x10)
            
            # Real-time protection is typically indicated when enabled
            # For most products, if enabled bit is set, real-time is active
            # More precise detection varies by vendor
            realtime_protection = enabled
            
            products.append({
                "name": av.displayName,
                "enabled": enabled,
                "realtime_protection": realtime_protection,
                "definitions_updated": definitions_updated,
                "product_state_raw": product_state
            })
            
            # Update summary flags
            if enabled:
                any_enabled = True
            if realtime_protection:
                any_realtime_active = True
            if not definitions_updated:
                all_definitions_current = False
        
        return {
            "query_method": "wmi",
            "products": products,
            "summary": {
                "total_products": len(products),
                "any_enabled": any_enabled,
                "any_realtime_active": any_realtime_active,
                "all_definitions_current": all_definitions_current
            }
        }
        
    except ImportError:
        # wmi library not installed, fall back to PowerShell
        return _fallback_defender_check("wmi library not available")
    except Exception as e:
        # Any other error, fall back to PowerShell
        return _fallback_defender_check(f"Unexpected error: {str(e)}")


def _fallback_defender_check(reason):
    """
    Fallback method using PowerShell to check Windows Defender status
    when WMI query fails or is unavailable.
    """
    try:
        command = ["powershell", "-Command", "Get-MpComputerStatus | Select-Object -ExpandProperty RealTimeProtectionEnabled"]
        output = subprocess.check_output(command, text=True).strip()
        
        enabled = output == "True"
        
        return {
            "query_method": "powershell",
            "fallback_reason": reason,
            "products": [
                {
                    "name": "Windows Defender",
                    "enabled": enabled,
                    "realtime_protection": enabled,
                    "definitions_updated": None,  # Not available via PowerShell
                    "product_state_raw": None
                }
            ] if output != "Unknown" else [],
            "summary": {
                "total_products": 1 if output != "Unknown" else 0,
                "any_enabled": enabled if output != "Unknown" else False,
                "any_realtime_active": enabled if output != "Unknown" else False,
                "all_definitions_current": None  # Not available via PowerShell
            }
        }
    except subprocess.CalledProcessError:
        return {
            "query_method": "unknown",
            "fallback_reason": reason,
            "products": [],
            "summary": {
                "total_products": 0,
                "any_enabled": False,
                "any_realtime_active": False,
                "all_definitions_current": False
            }
        }


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

    # Use new antivirus_posture structure if available, fallback to old defender field
    antivirus = scan.get("antivirus_posture", {})
    summary = antivirus.get("summary", {})
    
    # Check if antivirus_posture data is available
    if antivirus:
        # Check if no antivirus is enabled
        if not summary.get("any_enabled", False):
            flags.append({
                "id": "AV_DISABLED",
                "severity": "HIGH",
                "description": "No antivirus protection is enabled"
            })
        
        # Check if antivirus is enabled but real-time protection is off
        elif summary.get("any_enabled") and not summary.get("any_realtime_active", False):
            flags.append({
                "id": "AV_REALTIME_OFF",
                "severity": "HIGH",
                "description": "Antivirus is enabled but real-time protection is off"
            })
        
        # Check if definitions are outdated (only if we have this information)
        if summary.get("all_definitions_current") is False:
            flags.append({
                "id": "AV_OUTDATED_DEFS",
                "severity": "MEDIUM",
                "description": "Antivirus definitions are out of date"
            })
    else:
        # Fallback to old defender field for backward compatibility
        defender = scan["security"]["defender"].get("realtime_protection")
        
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

    firewall = scan["security"]["firewall"]
    software = len(scan["installed_softwares"])

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
            "defender": get_defender_status(),  # Keep for backward compatibility
            "firewall": get_firewall_status()
        },
        "antivirus_posture": get_antivirus_posture(),  # New WMI-based AV detection
        # "installed_softwares": len(get_installed_software())
        "installed_softwares": get_installed_software(),  # Keep for backward compatibility
        "software_inventory": build_software_inventory()  # New comprehensive inventory
    }

    # scan["risk_flags"] = evaluate_basic_risk_flags(scan)

    return scan

# print(day1_scan())



# if __name__ == "__main__":
#     scan_result = run_day1_scan()
#     print(json.dumps(scan_result, indent=2))



