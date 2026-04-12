"""
linux_commands.py
-----------------
Linux equivalents of day1, day2, day6, and day7 data collection functions.

Covers:
  - System info           (day1: get_system_info)
  - Software inventory    (day1: dpkg / rpm instead of winreg)
  - Process listing       (day1: psutil — cross-platform)
  - Linux services        (day1: systemctl instead of win_service_iter)
  - Antivirus posture     (day1: ClamAV / rkhunter instead of WMI)
  - Firewall status       (day1: ufw / firewall-cmd / iptables instead of netsh)
  - Runtime detection     (day2: java / python3)
  - Privilege posture     (day6: geteuid / /etc/group instead of winreg + net user)
  - Exposure posture      (day7: ss / smb.conf / systemctl instead of winreg + sc query)

All functions return the SAME dict schema as their Windows counterparts
so linux_data.py and agent.py require zero schema changes.
"""

import platform
import socket
import subprocess
import os
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


# =============================================================================
# System Info  (already cross-platform — identical to day1)
# =============================================================================

def get_system_info() -> dict:
    return {
        "hostname": socket.gethostname(),
        "os": platform.system(),
        "os_version": platform.version(),
        "os_release": platform.release()
    }


# =============================================================================
# Software Inventory
# =============================================================================

def normalize_software_name(name: str) -> str:
    if not name:
        return ""
    return (name.lower()
            .replace('.exe', '')
            .replace(' ', '')
            .replace('-', '')
            .replace('_', ''))


def get_installed_software() -> list:
    """
    Layer 1: Package-manager based software detection.

    Primary:  dpkg-query  (Debian / Ubuntu / Mint)
    Fallback: rpm -qa     (RHEL / CentOS / Fedora / OpenSUSE)
    """
    software_list = []
    seen_names = set()

    # ── dpkg (Debian-family) ─────────────────────────────────────────────────
    try:
        output = subprocess.check_output(
            ["dpkg-query", "-W",
             "-f=${Package}\t${Version}\t${Maintainer}\t${db:Status-Abbrev}\n"],
            text=True, timeout=15, stderr=subprocess.DEVNULL
        )
        for line in output.splitlines():
            parts = line.split("\t")
            if len(parts) < 4:
                continue
            status_abbrev = parts[3].strip()
            # Only include installed packages (status starts with 'ii')
            if not status_abbrev.startswith("ii"):
                continue
            name = parts[0].strip()
            version = parts[1].strip() or "Unknown"
            publisher = parts[2].strip() or "Unknown"
            normalized = normalize_software_name(name)
            if not normalized or normalized in seen_names:
                continue
            seen_names.add(normalized)
            software_list.append({
                "name": name,
                "version": version,
                "publisher": publisher,
                "install_location": None,
                "source": "dpkg"
            })
        return software_list          # return early if dpkg succeeded
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    # ── rpm (Red Hat-family) ─────────────────────────────────────────────────
    try:
        output = subprocess.check_output(
            ["rpm", "-qa", "--queryformat", "%{NAME}\t%{VERSION}\t%{VENDOR}\n"],
            text=True, timeout=15, stderr=subprocess.DEVNULL
        )
        for line in output.splitlines():
            parts = line.split("\t")
            if not parts or not parts[0].strip():
                continue
            name = parts[0].strip()
            version = parts[1].strip() if len(parts) > 1 else "Unknown"
            publisher = parts[2].strip() if len(parts) > 2 else "Unknown"
            normalized = normalize_software_name(name)
            if not normalized or normalized in seen_names:
                continue
            seen_names.add(normalized)
            software_list.append({
                "name": name,
                "version": version,
                "publisher": publisher,
                "install_location": None,
                "source": "rpm"
            })
        return software_list
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    return software_list


def get_running_processes() -> list:
    """
    Layer 2: Running process detection via psutil.
    psutil is fully cross-platform — logic identical to day1.
    """
    try:
        import psutil
    except ImportError:
        return []

    processes = []
    seen_names = set()
    KERNEL_THREADS = {'kthreadd', 'ksoftirqd', 'migration', 'rcu_sched',
                      'watchdog', 'kworker', 'kdevtmpfs', 'netns', 'khungtaskd'}

    for proc in psutil.process_iter(['name', 'exe']):
        try:
            name = proc.info.get('name')
            exe_path = proc.info.get('exe')
            if not name or name in seen_names or name in KERNEL_THREADS:
                continue
            processes.append({
                "name": name,
                "executable_path": exe_path,
                "runtime_only": True,
                "source": "process"
            })
            seen_names.add(name)
        except Exception:
            continue

    return processes


def get_linux_services() -> list:
    """
    Layer 3: Systemd service listing.
    Linux equivalent of psutil.win_service_iter().

    Primary:  systemctl list-units
    Fallback: parse /etc/init.d/
    """
    services = []

    # ── systemctl ────────────────────────────────────────────────────────────
    try:
        output = subprocess.check_output(
            ["systemctl", "list-units", "--type=service",
             "--all", "--no-pager", "--no-legend"],
            text=True, timeout=10, stderr=subprocess.DEVNULL
        )
        for line in output.splitlines():
            parts = line.split()
            if len(parts) < 4:
                continue
            name = parts[0].replace(".service", "")
            active_state = parts[2]   # active / inactive / failed
            sub_state = parts[3]      # running / dead / exited …
            services.append({
                "name": name,
                "display_name": name,
                "binary_path": None,
                "status": sub_state,
                "background_service": True,
                "source": "systemctl"
            })
        return services
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    # ── /etc/init.d/ fallback (SysV-style) ──────────────────────────────────
    try:
        initd = Path("/etc/init.d")
        if initd.exists():
            for script in initd.iterdir():
                if script.is_file():
                    services.append({
                        "name": script.name,
                        "display_name": script.name,
                        "binary_path": str(script),
                        "status": "unknown",
                        "background_service": True,
                        "source": "init.d"
                    })
    except Exception:
        pass

    return services


def build_software_inventory() -> dict:
    """
    Combines packages + running processes + services with deduplication.
    Returns same schema as day1.build_software_inventory().
    """
    installed = get_installed_software()
    processes = get_running_processes()
    services = get_linux_services()

    inventory = []
    seen = set()

    for sw in installed:
        normalized = normalize_software_name(sw['name'])
        if normalized and normalized not in seen:
            inventory.append(sw)
            seen.add(normalized)

    for proc in processes:
        exe_path = proc.get('executable_path', '')
        if exe_path:
            try:
                normalized = normalize_software_name(Path(exe_path).stem)
            except Exception:
                normalized = normalize_software_name(proc['name'])
        else:
            normalized = normalize_software_name(proc['name'])
        if normalized and normalized not in seen:
            inventory.append(proc)
            seen.add(normalized)

    for svc in services:
        normalized_svc = normalize_software_name(svc.get('name', ''))
        if normalized_svc and normalized_svc not in seen:
            inventory.append(svc)
            seen.add(normalized_svc)

    return {
        "inventory": inventory,
        "counts": {
            "total_registered": len(installed),
            "total_runtime_only": sum(1 for i in inventory if i.get('runtime_only')),
            "total_services": sum(1 for i in inventory if i.get('background_service')),
            "total_unique": len(inventory)
        }
    }


# =============================================================================
# Antivirus / Security
# =============================================================================

def get_defender_status() -> dict:
    """
    Linux equivalent: check if ClamAV real-time daemon (clamd) is running.
    Returns same key 'realtime_protection' as Windows version.
    """
    try:
        import psutil
        running = {p.info['name'] for p in psutil.process_iter(['name'])}
        if 'clamd' in running or 'clamav' in running:
            return {"realtime_protection": "True"}
        return {"realtime_protection": "False"}
    except Exception:
        return {"realtime_protection": "Unknown"}


def get_antivirus_posture() -> dict:
    """
    Linux AV detection.

    Checks for ClamAV, rkhunter, chkrootkit.
    Primary:  psutil process scan (running daemon = realtime active)
    Fallback: binary existence check (installed but not running)
    """
    AV_DEFINITIONS = [
        {"name": "ClamAV",     "process": "clamd",      "binary": "/usr/bin/clamscan"},
        {"name": "rkhunter",   "process": "rkhunter",   "binary": "/usr/bin/rkhunter"},
        {"name": "chkrootkit", "process": "chkrootkit", "binary": "/usr/sbin/chkrootkit"},
    ]

    # Get running process names
    try:
        import psutil
        running_names = {p.info['name'] for p in psutil.process_iter(['name'])}
    except Exception:
        running_names = set()

    products = []
    any_enabled = False
    any_realtime_active = False

    for av in AV_DEFINITIONS:
        binary_exists = os.path.isfile(av["binary"])
        process_running = av["process"] in running_names

        if binary_exists or process_running:
            products.append({
                "name": av["name"],
                "enabled": binary_exists,
                "realtime_protection": process_running,
                "definitions_updated": True,   # Can't determine without root
                "product_state_raw": None
            })
            if binary_exists:
                any_enabled = True
            if process_running:
                any_realtime_active = True

    return {
        "query_method": "process_scan",
        "products": products,
        "summary": {
            "total_products": len(products),
            "any_enabled": any_enabled,
            "any_realtime_active": any_realtime_active,
            "all_definitions_current": bool(products)
        }
    }


# =============================================================================
# Firewall Status
# =============================================================================

def get_firewall_status() -> dict:
    """
    Returns same profile-keyed dict as Windows netsh version:
    {"Domain": "ON"/"OFF"/"Unknown", "Private": ..., "Public": ...}

    Primary:  ufw status         (Ubuntu/Debian)
    Fallback: firewall-cmd --state  (RHEL/CentOS/Fedora)
    Fallback: iptables -L INPUT  (any Linux)
    """
    # ── ufw ─────────────────────────────────────────────────────────────────
    try:
        output = subprocess.check_output(
            ["ufw", "status"],
            text=True, timeout=5, stderr=subprocess.DEVNULL
        )
        if "Status: active" in output:
            return {"Domain": "Unknown", "Private": "ON", "Public": "ON",
                    "source": "ufw"}
        elif "Status: inactive" in output:
            return {"Domain": "Unknown", "Private": "OFF", "Public": "OFF",
                    "source": "ufw"}
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    # ── firewall-cmd ─────────────────────────────────────────────────────────
    try:
        output = subprocess.check_output(
            ["firewall-cmd", "--state"],
            text=True, timeout=5, stderr=subprocess.DEVNULL
        ).strip()
        if output == "running":
            return {"Domain": "Unknown", "Private": "ON", "Public": "ON",
                    "source": "firewall-cmd"}
        return {"Domain": "Unknown", "Private": "OFF", "Public": "OFF",
                "source": "firewall-cmd"}
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    # ── iptables ─────────────────────────────────────────────────────────────
    try:
        output = subprocess.check_output(
            ["iptables", "-L", "INPUT", "-n"],
            text=True, timeout=5, stderr=subprocess.DEVNULL
        )
        has_rules = "DROP" in output or "REJECT" in output
        state = "ON" if has_rules else "OFF"
        return {"Domain": "Unknown", "Private": state, "Public": state,
                "source": "iptables"}
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    return {"Error": "Unable to determine firewall status"}


# =============================================================================
# Runtime Detection  (day2 equivalent)
# =============================================================================

def detect_java_runtime() -> dict:
    """Works on Linux — same logic as day2, same return schema."""
    try:
        output = subprocess.check_output(
            ["java", "--version"],
            text=True, timeout=5, stderr=subprocess.STDOUT
        )
        return {"present": True, "version_raw": output.splitlines()[0]}
    except FileNotFoundError:
        return {"present": False, "version_raw": None}
    except subprocess.TimeoutExpired:
        return {"present": "Unknown", "error": "Timeout"}
    except Exception as e:
        return {"present": "Unknown", "error": str(e)}


def detect_python_runtime() -> dict:
    """
    On Linux 'python' may not exist — try 'python3' first.
    Returns same schema as day2.detect_python_runtime().
    """
    for cmd in ["python3", "python"]:
        try:
            output = subprocess.check_output(
                [cmd, "--version"],
                text=True, timeout=5, stderr=subprocess.STDOUT
            )
            return {"present": True, "version_raw": output.strip()}
        except FileNotFoundError:
            continue
        except subprocess.TimeoutExpired:
            return {"present": "Unknown", "error": "Timeout"}
        except Exception as e:
            return {"present": "Unknown", "error": str(e)}
    return {"present": False, "version_raw": None}


def collect_runtimes() -> dict:
    return {
        "java": detect_java_runtime(),
        "python": detect_python_runtime()
    }


# =============================================================================
# Privilege Posture  (day6 equivalent)
# =============================================================================

def get_execution_privilege() -> str:
    """
    Primary:  os.geteuid() == 0  (root)
    Fallback: `id -u` subprocess
    """
    try:
        return "elevated" if os.geteuid() == 0 else "standard"
    except AttributeError:
        try:
            uid = subprocess.check_output(
                ["id", "-u"], text=True, timeout=5
            ).strip()
            return "elevated" if uid == "0" else "standard"
        except Exception:
            return "unknown"


def get_user_account_role() -> str:
    """
    Primary:  parse /etc/group for sudo / wheel / admin membership
    Fallback: `groups` command output
    """
    ADMIN_GROUPS = {"sudo", "wheel", "admin", "root"}
    try:
        username = subprocess.check_output(
            ["whoami"], text=True, timeout=5
        ).strip()

        with open("/etc/group", "r") as f:
            for line in f:
                parts = line.strip().split(":")
                if len(parts) < 4:
                    continue
                group_name = parts[0]
                members = [m.strip() for m in parts[3].split(",") if m.strip()]
                if group_name in ADMIN_GROUPS and username in members:
                    return "local_admin"
        return "user_standard"
    except Exception:
        pass

    try:
        output = subprocess.check_output(
            ["groups"], text=True, timeout=5
        ).strip()
        if any(g in output.split() for g in ADMIN_GROUPS):
            return "local_admin"
        return "user_standard"
    except Exception:
        return "unknown"


def is_uac_enabled():
    """UAC is Windows-only. Not applicable on Linux."""
    return "not_applicable"


def collect_privilege_posture() -> dict:
    """Returns same schema as day6.collect_privilege_posture()."""
    data = {
        "execution_privilege": "unknown",
        "user_account_role": "unknown",
        "uac_enabled": "not_applicable",
        "confidence": "high",
        "evidence": ["UAC: not_applicable on Linux"],
        "errors": []
    }

    exec_priv = get_execution_privilege()
    data["execution_privilege"] = exec_priv
    if exec_priv == "unknown":
        data["confidence"] = "medium"
        data["errors"].append("Unable to determine execution elevation.")
    else:
        data["evidence"].append(f"Execution Privilege: {exec_priv} (via geteuid)")

    user_role = get_user_account_role()
    data["user_account_role"] = user_role
    if user_role == "unknown":
        data["confidence"] = "medium"
        data["errors"].append("Unable to determine user account role.")
    else:
        data["evidence"].append(f"User Account Role: {user_role} (via /etc/group)")

    return data


# =============================================================================
# Exposure Posture  (day7 equivalent)
# =============================================================================

def get_listening_ports() -> list:
    """
    Primary:  ss -tlnp   (iproute2 — always present on modern Linux)
    Fallback: netstat -tlnp  (net-tools, may not be installed)
    """
    ports = []

    # ── ss ───────────────────────────────────────────────────────────────────
    try:
        output = subprocess.check_output(
            ["ss", "-tlnp"],
            text=True, timeout=5, stderr=subprocess.DEVNULL
        )
        for line in output.splitlines()[1:]:   # skip header
            parts = line.split()
            if len(parts) < 4:
                continue
            local_address = parts[3]
            if ":" in local_address:
                port = local_address.rsplit(":", 1)[-1]
                pid_info = parts[-1] if len(parts) > 4 else "unknown"
                ports.append({
                    "protocol": "TCP",
                    "port": port,
                    "pid": pid_info
                })
        return ports
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    # ── netstat fallback ─────────────────────────────────────────────────────
    try:
        output = subprocess.check_output(
            ["netstat", "-tlnp"],
            text=True, timeout=5, stderr=subprocess.DEVNULL
        )
        for line in output.splitlines():
            if "LISTEN" not in line:
                continue
            parts = line.split()
            if len(parts) < 4:
                continue
            local_address = parts[3]
            if ":" in local_address:
                port = local_address.rsplit(":", 1)[-1]
                pid_raw = parts[-1] if len(parts) > 4 else "unknown"
                pid = pid_raw.split("/")[0] if "/" in pid_raw else pid_raw
                ports.append({
                    "protocol": "TCP",
                    "port": port,
                    "pid": pid
                })
        return ports
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    return ports


COMMON_RISKY_PORTS = {
    "21":   "FTP",
    "23":   "Telnet",
    "22":   "SSH",
    "3389": "RDP (xrdp)",
    "445":  "SMB",
    "5985": "WinRM HTTP",
    "5986": "WinRM HTTPS",
    "2375": "Docker (unencrypted)",
    "6379": "Redis (unauthenticated)",
    "27017":"MongoDB (unauthenticated)",
}


def flag_risky_ports(port_list: list) -> list:
    """Identical logic to day7.flag_risky_ports()."""
    seen = set()
    risky = []
    for entry in port_list:
        port = entry["port"]
        protocol = entry["protocol"]
        key = (port, protocol)
        if key in seen:
            continue
        if port in COMMON_RISKY_PORTS:
            risky.append({
                "port": port,
                "service": COMMON_RISKY_PORTS[port],
                "protocol": protocol
            })
            seen.add(key)
    return risky


def is_rdp_enabled() -> bool:
    """
    Primary:  systemctl is-active xrdp
    Fallback: check if port 3389 is listening
    """
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "xrdp"],
            text=True, capture_output=True, timeout=5
        )
        if result.stdout.strip() == "active":
            return True
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    ports = get_listening_ports()
    return any(p["port"] == "3389" for p in ports)


def is_smbv1_enabled():
    """
    Primary:  parse /etc/samba/smb.conf for min protocol
    Fallback: return None (unknown)
    """
    SMB1_VALUES = {"nt1", "lanman1", "lanman2", "core", "coreplus"}
    try:
        with open("/etc/samba/smb.conf", "r") as f:
            for line in f:
                stripped = line.strip().lower()
                if stripped.startswith("min protocol") and "=" in stripped:
                    val = stripped.split("=", 1)[1].strip()
                    return val in SMB1_VALUES
        # samba installed but min protocol not set — defaults to SMBv2+
        return False
    except FileNotFoundError:
        return False        # samba not installed → no SMBv1
    except Exception:
        return None         # config unreadable → unknown


def is_remote_registry_enabled():
    """Remote Registry is Windows-only. Not applicable on Linux."""
    return None


def is_winrm_enabled() -> bool:
    """
    Linux equivalent: OpenSSH server (sshd).
    Primary:  systemctl is-active ssh / sshd
    Fallback: check if port 22 is listening
    """
    for service in ("ssh", "sshd"):
        try:
            result = subprocess.run(
                ["systemctl", "is-active", service],
                text=True, capture_output=True, timeout=5
            )
            if result.stdout.strip() == "active":
                return True
        except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
            pass

    ports = get_listening_ports()
    return any(p["port"] == "22" for p in ports)


def collect_exposure_posture() -> dict:
    """Returns same schema as day7.collect_exposure_posture()."""
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
    data["rdp_enabled"] = rdp
    data["evidence"].append(f"RDP (xrdp) checked via systemctl: {'active' if rdp else 'inactive'}")

    smbv1 = is_smbv1_enabled()
    if smbv1 is not None:
        data["smbv1_enabled"] = smbv1
        data["evidence"].append("SMBv1 status read from /etc/samba/smb.conf")
    else:
        data["confidence"] = "medium"
        data["errors"].append("Unable to determine SMBv1 status (smb.conf unreadable)")

    data["remote_registry_enabled"] = None
    data["evidence"].append("Remote Registry: not_applicable on Linux")

    winrm = is_winrm_enabled()
    data["winrm_enabled"] = winrm
    data["evidence"].append(
        f"SSH (OpenSSH, Linux equivalent of WinRM): {'active' if winrm else 'inactive'}"
    )

    listening_ports = get_listening_ports()
    if listening_ports is not None:
        data["listening_ports_count"] = len(listening_ports)
        data["risky_listening_ports"] = flag_risky_ports(listening_ports)
        data["evidence"].append("Listening ports retrieved via ss / netstat")
    else:
        data["confidence"] = "medium"
        data["errors"].append("Unable to retrieve listening ports")

    return data


# =============================================================================
# Main Scan Builder  (equivalent to day2.run_day2_scan)
# =============================================================================

def run_linux_scan() -> dict:
    """
    Assembles the complete Linux scan dict.
    Schema matches the Windows day2.run_day2_scan() output exactly.
    """
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
        "antivirus_posture": get_antivirus_posture(),
        "software_inventory": build_software_inventory(),
        "runtimes": collect_runtimes()
    }
    return scan


# =============================================================================
# Quick self-test
# =============================================================================

if __name__ == "__main__":
    import json
    sections = {
        "system":              get_system_info(),
        "firewall":            get_firewall_status(),
        "antivirus_posture":   get_antivirus_posture(),
        "privilege_posture":   collect_privilege_posture(),
        "exposure_posture":    collect_exposure_posture(),
        "runtimes":            collect_runtimes(),
        "software_summary":    {
            k: v for k, v in build_software_inventory().items() if k == "counts"
        },
    }
    print(json.dumps(sections, indent=2))
