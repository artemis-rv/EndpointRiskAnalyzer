import winreg
import subprocess

def check_registry_value(path, key_name):
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path)
        value, _ = winreg.QueryValueEx(key, key_name)
        return value
    except:
        return None

def is_rdp_enabled():
    value = check_registry_value(
        r"SYSTEM\CurrentControlSet\Control\Terminal Server",
        "fDenyTSConnections"
    )
    if value is None:
        return None
    return value == 0  # 0 means RDP allowed

def is_smbv1_enabled():
    value = check_registry_value(
        r"SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters",
        "SMB1"
    )
    if value is None:
        return None
    return value == 1

def is_remote_registry_enabled():
    try:
        output = subprocess.check_output(
            'sc query RemoteRegistry',
            shell=True,
            text=True
        )
        return "RUNNING" in output
    except:
        return None

# remote management
def is_winrm_enabled():
    try:
        output = subprocess.check_output(
            'winrm get winrm/config',
            shell=True,
            text=True
        )
        return True
    except:
        return False

def collect_exposure_posture():
    data = {
        "rdp_enabled": None,
        "smbv1_enabled": None,
        "remote_registry_enabled": None,
        "winrm_enabled": None,
        "confidence": "high",
        "evidence": [],
        "errors": []
    }

    rdp = is_rdp_enabled()
    if rdp is not None:
        data["rdp_enabled"] = rdp
        data["evidence"].append("RDP status read from registry")
    else:
        data["confidence"] = "medium"
        data["errors"].append("Unable to determine RDP status")

    smbv1 = is_smbv1_enabled()
    if smbv1 is not None:
        data["smbv1_enabled"] = smbv1
        data["evidence"].append("SMBv1 configuration read from registry")
    else:
        data["confidence"] = "medium"
        data["errors"].append("Unable to determine SMBv1 status")

    remote_reg = is_remote_registry_enabled()
    if remote_reg is not None:
        data["remote_registry_enabled"] = remote_reg
        data["evidence"].append("RemoteRegistry service state queried")
    else:
        data["confidence"] = "medium"
        data["errors"].append("Unable to determine Remote Registry status")

    winrm = is_winrm_enabled()
    data["winrm_enabled"] = winrm
    data["evidence"].append("WinRM configuration checked")

    listening_ports = get_listening_ports()
    if listening_ports is not None:
        data["listening_ports_count"] = len(listening_ports)
        data["risky_listening_ports"] = flag_risky_ports(listening_ports)
        data["evidence"].append("Listening ports retrieved via netstat")
    else:
        data["confidence"] = "medium"
        data["errors"].append("Unable to retrieve listening ports")


    return data

def get_listening_ports():
    ports = []
    try:
        output = subprocess.check_output(
            "netstat -ano",
            shell=True,
            text=True
        )
        for line in output.splitlines():
            if "LISTENING" in line:
                parts = line.split()
                protocol = parts[0]
                local_address = parts[1]
                pid = parts[-1]

                if ":" in local_address:
                    port = local_address.split(":")[-1]
                    ports.append({
                        "protocol": protocol,
                        "port": port,
                        "pid": pid
                    })
    except Exception:
        return None

    return ports

COMMON_RISKY_PORTS = {
    "21": "FTP",
    "23": "Telnet",
    "3389": "RDP",
    "445": "SMB",
    "5985": "WinRM HTTP",
    "5986": "WinRM HTTPS"
}

def flag_risky_ports(port_list):
    risky = []
    for entry in port_list:
        port = entry["port"]
        if port in COMMON_RISKY_PORTS:
            risky.append({
                "port": port,
                "service": COMMON_RISKY_PORTS[port],
                "protocol": entry["protocol"]
            })
    return risky
