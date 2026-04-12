"""
linux_cis.py
------------
CIS Linux Server Benchmark Level 1 compliance checks.

Covers:
  SSH Hardening       (CIS 5.2.x) — sshd_config file parsing
  Audit Daemon        (CIS 4.1.x, 4.2.x) — systemctl
  Network Parameters  (CIS 3.1.x, 3.2.x) — /proc/sys/net read
  Password Policy     (CIS 5.4.x) — /etc/login.defs parsing
  File Permissions    (CIS 6.1.x) — os.stat()
  User Accounts       (CIS 6.2.x) — /etc/passwd, /etc/shadow parsing
  Package Security    (CIS 1.2.x) — APT GPG / RPM presence

Output schema is identical to day8_cis_compliance.collect_cis_compliance():
  {"controls": [...], "compliance_score": {...}, "priority_focus": [...]}

Security measures:
  - All subprocess calls use list form only (shell=False enforced)
  - All file paths are module-level constants — zero user input
  - /proc/sys/ paths validated against allowed prefix before open()
  - No sensitive values (password hashes, key material) are returned
  - File reads use explicit encoding='utf-8' — no binary ambiguity
  - Logging uses %s-style formatting — no f-string injection into logger
"""

import os
import subprocess
import logging
import sys
import threading
import time
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# Status Constants — identical to day8 so schema is compatible
# =============================================================================
STATUS_COMPLIANT              = "compliant"
STATUS_NON_COMPLIANT          = "non_compliant"
STATUS_NOT_CONFIGURED         = "not_configured"
STATUS_INSUFFICIENT_PRIVILEGE = "insufficient_privilege"
STATUS_FEATURE_NOT_INSTALLED  = "feature_not_installed"
STATUS_QUERY_FAILED           = "query_failed"


# =============================================================================
# SECURITY: Hardcoded path constants — never constructed from external input
# =============================================================================
_SSHD_CONFIG  = "/etc/ssh/sshd_config"
_LOGIN_DEFS   = "/etc/login.defs"
_SHADOW       = "/etc/shadow"
_PASSWD       = "/etc/passwd"
_GROUP        = "/etc/group"
_PROC_IPV4    = "/proc/sys/net/ipv4"
_APT_GPG_DIR  = "/etc/apt/trusted.gpg.d"
_PROC_ALLOWED = "/proc/sys/net/"          # path prefix allowlist


# =============================================================================
# Terminal Spinner (self-contained copy — avoids cross-package import)
# =============================================================================
class TerminalSpinner:
    """Animated progress spinner — no-op when stdout is not a TTY."""

    def __init__(self, message: str = "", total: int | None = None):
        self.message   = message
        self.total     = total
        self._stop     = False
        self._frame    = 0
        self._progress = 0
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if not sys.stdout.isatty():
            return
        self._stop = False
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self) -> None:
        symbols = "|/-\\"
        while not self._stop:
            pct = ""
            if self.total:
                n   = min(self._progress, self.total)
                pct = f" {n}/{self.total} ({int(n * 100 / self.total)}%)"
            sys.stdout.write(f"\r{self.message} {symbols[self._frame % 4]}{pct}")
            sys.stdout.flush()
            time.sleep(0.1)
            self._frame += 1
        sys.stdout.write("\r" + " " * (len(self.message) + 30) + "\r")
        sys.stdout.flush()

    def advance(self, step: int = 1) -> None:
        self._progress += step

    def stop(self) -> None:
        if not sys.stdout.isatty():
            return
        self._stop = True
        if self._thread:
            self._thread.join()
        self._thread = None


# =============================================================================
# Low-level helpers  (all path-validated; no shell; no user data in commands)
# =============================================================================

def _read_proc_value(path: str) -> Tuple[str, str, str]:
    """
    Read a single /proc/sys/net/ value safely.
    Path is validated against _PROC_ALLOWED before open() to prevent traversal.
    Returns (value, status, reason).
    """
    real = os.path.realpath(path)
    if not real.startswith(_PROC_ALLOWED):
        return "", STATUS_QUERY_FAILED, f"Path outside allowed prefix: {path}"
    try:
        with open(real, "r", encoding="utf-8") as fh:
            return fh.read().strip(), "success", "Read successfully"
    except PermissionError:
        return "", STATUS_INSUFFICIENT_PRIVILEGE, f"Permission denied: {real}"
    except FileNotFoundError:
        return "", STATUS_NOT_CONFIGURED, f"Not found: {real}"
    except OSError as exc:
        return "", STATUS_QUERY_FAILED, f"Read error: {exc}"


def _parse_kv_config(path: str, key: str,
                     comment_char: str = "#") -> Tuple[str | None, str, str]:
    """
    Parse a whitespace-separated key-value config file (sshd_config / login.defs).
    path and key are caller-supplied MODULE CONSTANTS only — never user input.
    Returns (value, status, reason).
    """
    if not os.path.isabs(path):
        return None, STATUS_QUERY_FAILED, "Only absolute paths allowed"
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith(comment_char):
                    continue
                parts = line.split(None, 1)
                if len(parts) == 2 and parts[0].lower() == key.lower():
                    return parts[1].strip(), "success", f"Found {key}"
        return None, STATUS_NOT_CONFIGURED, f"{key} not set in {path}"
    except PermissionError:
        return None, STATUS_INSUFFICIENT_PRIVILEGE, f"Cannot read {path}"
    except FileNotFoundError:
        return None, STATUS_FEATURE_NOT_INSTALLED, f"{path} not found"
    except OSError as exc:
        return None, STATUS_QUERY_FAILED, f"Read error: {exc}"


def _safe_exec(cmd: List[str], timeout: int = 5) -> Tuple[str, str, str]:
    """
    Execute a command safely without shell expansion.
    cmd MUST be a list of string literals — never include runtime strings.
    Returns (stdout, status, reason).
    """
    try:
        out = subprocess.check_output(
            cmd, text=True, timeout=timeout, stderr=subprocess.DEVNULL
        ).strip()
        return out, "success", "Executed successfully"
    except subprocess.TimeoutExpired:
        return "", STATUS_QUERY_FAILED, "Command timed out"
    except subprocess.CalledProcessError as exc:
        return "", STATUS_QUERY_FAILED, f"Exit code {exc.returncode}"
    except FileNotFoundError:
        return "", STATUS_FEATURE_NOT_INSTALLED, f"{cmd[0]} not found"
    except Exception as exc:
        return "", STATUS_QUERY_FAILED, f"Unexpected: {exc}"


def _file_mode(path: str) -> Tuple[int | None, str, str]:
    """Return (octal_permissions, status, reason) via os.stat() — no shell."""
    try:
        return os.stat(path).st_mode & 0o777, "success", "stat() OK"
    except PermissionError:
        return None, STATUS_INSUFFICIENT_PRIVILEGE, f"Cannot stat {path}"
    except FileNotFoundError:
        return None, STATUS_FEATURE_NOT_INSTALLED, f"{path} not found"
    except OSError as exc:
        return None, STATUS_QUERY_FAILED, str(exc)


def _make_result(control_id: str, name: str, status: str,
                 severity_weight: int, details: str, reason: str,
                 source: str, confidence: str, remediation: str) -> Dict[str, Any]:
    """Single constructor for the control dict — keeps all callers consistent."""
    return {
        "control_id":         control_id,
        "name":               name,
        "status":             status,
        "severity_weight":    severity_weight,
        "details":            details,
        "reason":             reason,
        "source_method_used": source,
        "confidence_level":   confidence,
        "remediation_hint":   remediation,
    }


# =============================================================================
# Generic parameterised check factories — eliminate repetition
# =============================================================================

def _ssh_directive_eq(directive: str, expected: str,
                      control_id: str, name: str, severity_weight: int,
                      ok_reason: str, fail_reason: str,
                      remediation: str) -> Dict[str, Any]:
    """Check that an sshd_config directive equals an expected value."""
    value, status, reason = _parse_kv_config(_SSHD_CONFIG, directive)
    if status == "success":
        ok = value.lower() == expected.lower()
        return _make_result(
            control_id, name,
            STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
            severity_weight,
            f"{directive}: {value}",
            ok_reason if ok else f"{fail_reason} (found: {value})",
            "sshd_config", "high", remediation,
        )
    return _make_result(
        control_id, name, status, severity_weight,
        reason, f"Unable to validate {directive}: {reason}",
        "sshd_config", "none", remediation,
    )


def _proc_net_eq(path: str, expected: str,
                 control_id: str, name: str, severity_weight: int,
                 ok_reason: str, fail_reason: str,
                 remediation: str) -> Dict[str, Any]:
    """Check a /proc/sys/net/ value equals expected."""
    value, status, reason = _read_proc_value(path)
    if status == "success":
        ok = value == expected
        return _make_result(
            control_id, name,
            STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
            severity_weight,
            f"{os.path.basename(path)}: {value} (expected {expected})",
            ok_reason if ok else f"{fail_reason} (value: {value})",
            "proc_sys", "high", remediation,
        )
    return _make_result(
        control_id, name, status, severity_weight,
        reason, reason, "proc_sys", "none", remediation,
    )


def _login_defs_int(key: str, control_id: str, name: str,
                    severity_weight: int,
                    predicate,            # callable(int) -> bool
                    threshold_label: str,
                    ok_reason: str, fail_reason: str,
                    remediation: str) -> Dict[str, Any]:
    """Check an integer value in /etc/login.defs."""
    value, status, reason = _parse_kv_config(_LOGIN_DEFS, key)
    if status == "success":
        try:
            v = int(value)
            ok = predicate(v)
            return _make_result(
                control_id, name,
                STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
                severity_weight,
                f"{key}: {v} (required: {threshold_label})",
                ok_reason if ok else f"{fail_reason} ({v})",
                "login_defs", "high", remediation,
            )
        except ValueError:
            pass
    return _make_result(
        control_id, name,
        status if status != "success" else STATUS_QUERY_FAILED,
        severity_weight, reason, reason,
        "login_defs", "none", remediation,
    )


def _file_perms_max(path: str, max_octal: int,
                    control_id: str, name: str,
                    severity_weight: int, remediation: str) -> Dict[str, Any]:
    """Ensure file permissions do not exceed max_octal."""
    mode, status, reason = _file_mode(path)
    if status == "success":
        ok = (mode & ~max_octal) == 0
        return _make_result(
            control_id, name,
            STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
            severity_weight,
            f"{path}: {oct(mode)} (max allowed: {oct(max_octal)})",
            f"Permissions {oct(mode)} correct" if ok
            else f"Permissions {oct(mode)} too permissive (max {oct(max_octal)})",
            "os_stat", "high", remediation,
        )
    return _make_result(
        control_id, name, status, severity_weight,
        reason, reason, "os_stat", "none", remediation,
    )


# =============================================================================
# SSH Hardening  (CIS 5.2.x)
# =============================================================================

def check_ssh_permit_root_login() -> Dict[str, Any]:
    """CIS 5.2.2 — PermitRootLogin must be 'no', 'prohibit-password', or 'forced-commands-only'."""
    ALLOWED = {"no", "prohibit-password", "forced-commands-only"}
    value, status, reason = _parse_kv_config(_SSHD_CONFIG, "PermitRootLogin")
    if status == "success":
        ok = value.lower() in ALLOWED
        return _make_result(
            "5.2.2", "SSH PermitRootLogin Disabled",
            STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
            3,
            f"PermitRootLogin: {value}",
            "Root SSH login restricted" if ok else f"Root SSH login allowed (value: {value})",
            "sshd_config", "high",
            "Set 'PermitRootLogin no' in /etc/ssh/sshd_config, restart sshd",
        )
    if status == STATUS_NOT_CONFIGURED:
        return _make_result(
            "5.2.2", "SSH PermitRootLogin Disabled",
            STATUS_NON_COMPLIANT, 3,
            "PermitRootLogin not explicitly set (default may allow root)",
            "PermitRootLogin not configured — treating as non-compliant",
            "sshd_config", "medium",
            "Explicitly set 'PermitRootLogin no' in /etc/ssh/sshd_config",
        )
    return _make_result(
        "5.2.2", "SSH PermitRootLogin Disabled",
        status, 3, reason, reason, "sshd_config", "none",
        "Ensure /etc/ssh/sshd_config is readable",
    )


def check_ssh_protocol() -> Dict[str, Any]:
    """CIS 5.2.4 — SSH Protocol must be 2."""
    return _ssh_directive_eq(
        "Protocol", "2",
        "5.2.4", "SSH Protocol 2 Only", 3,
        "SSH Protocol 2 enforced",
        "SSH Protocol 1 allowed — susceptible to downgrade attacks",
        "Add 'Protocol 2' to /etc/ssh/sshd_config",
    )


def check_ssh_max_auth_tries() -> Dict[str, Any]:
    """CIS 5.2.5 — MaxAuthTries must be ≤ 4."""
    value, status, reason = _parse_kv_config(_SSHD_CONFIG, "MaxAuthTries")
    if status == "success":
        try:
            tries = int(value)
            ok = tries <= 4
            return _make_result(
                "5.2.5", "SSH MaxAuthTries ≤ 4",
                STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
                2, f"MaxAuthTries: {tries}",
                "MaxAuthTries within limit" if ok else f"MaxAuthTries {tries} exceeds limit of 4",
                "sshd_config", "high",
                "Set 'MaxAuthTries 4' in /etc/ssh/sshd_config",
            )
        except ValueError:
            pass
    return _make_result(
        "5.2.5", "SSH MaxAuthTries ≤ 4",
        status if status != "success" else STATUS_QUERY_FAILED,
        2, reason, reason, "sshd_config", "none",
        "Set 'MaxAuthTries 4' in /etc/ssh/sshd_config",
    )


def check_ssh_ignore_rhosts() -> Dict[str, Any]:
    """CIS 5.2.8 — IgnoreRhosts must be 'yes'."""
    return _ssh_directive_eq(
        "IgnoreRhosts", "yes",
        "5.2.8", "SSH IgnoreRhosts Enabled", 2,
        "SSH ignores .rhosts files",
        "SSH reads .rhosts — trust-based auth risk",
        "Set 'IgnoreRhosts yes' in /etc/ssh/sshd_config",
    )


def check_ssh_permit_empty_passwords() -> Dict[str, Any]:
    """CIS 5.2.11 — PermitEmptyPasswords must be 'no'."""
    return _ssh_directive_eq(
        "PermitEmptyPasswords", "no",
        "5.2.11", "SSH No Empty Passwords", 3,
        "SSH rejects empty passwords",
        "SSH allows empty passwords — trivial authentication bypass",
        "Set 'PermitEmptyPasswords no' in /etc/ssh/sshd_config",
    )


def check_ssh_permit_user_environment() -> Dict[str, Any]:
    """CIS 5.2.12 — PermitUserEnvironment must be 'no'."""
    return _ssh_directive_eq(
        "PermitUserEnvironment", "no",
        "5.2.12", "SSH No User Environment Override", 2,
        "SSH ignores user environment files",
        "SSH honours user env files — potential privilege escalation path",
        "Set 'PermitUserEnvironment no' in /etc/ssh/sshd_config",
    )


# =============================================================================
# Audit and Logging  (CIS 4.1.x, 4.2.x)
# =============================================================================

def check_auditd_running() -> Dict[str, Any]:
    """CIS 4.1.2 — auditd must be installed and running."""
    out, status, reason = _safe_exec(["systemctl", "is-active", "auditd"])
    if status == "success":
        ok = out == "active"
        return _make_result(
            "4.1.2", "Audit Daemon (auditd) Running",
            STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
            2, f"auditd state: {out}",
            "auditd is active" if ok else f"auditd not running (state: {out})",
            "systemctl", "high",
            "apt install auditd && systemctl enable --now auditd",
        )
    return _make_result(
        "4.1.2", "Audit Daemon (auditd) Running",
        status, 2, reason, reason, "systemctl", "none",
        "apt install auditd && systemctl enable --now auditd",
    )


def check_syslog_running() -> Dict[str, Any]:
    """CIS 4.2.1 — rsyslog or syslog-ng must be running."""
    for service in ("rsyslog", "syslog-ng", "syslog"):
        out, status, _ = _safe_exec(["systemctl", "is-active", service])
        if status == "success" and out == "active":
            return _make_result(
                "4.2.1", "Syslog Service Running",
                STATUS_COMPLIANT, 2,
                f"{service}: active",
                f"Syslog ({service}) is running",
                "systemctl", "high",
                "apt install rsyslog && systemctl enable --now rsyslog",
            )
    return _make_result(
        "4.2.1", "Syslog Service Running",
        STATUS_NON_COMPLIANT, 2,
        "rsyslog / syslog-ng: not active",
        "No syslog service found running — system events not logged",
        "systemctl", "high",
        "apt install rsyslog && systemctl enable --now rsyslog",
    )


# =============================================================================
# Network Parameter Checks  (CIS 3.1.x, 3.2.x)
# =============================================================================

def check_ip_forwarding_disabled() -> Dict[str, Any]:
    """CIS 3.1.1 — IP forwarding must be disabled."""
    return _proc_net_eq(
        f"{_PROC_IPV4}/ip_forward", "0",
        "3.1.1", "IP Forwarding Disabled", 2,
        "IP forwarding disabled (host is not acting as router)",
        "IP forwarding enabled — host can route packets (lateral movement risk)",
        "Add 'net.ipv4.ip_forward = 0' to /etc/sysctl.d/99-cis.conf && sysctl -p",
    )


def check_send_redirects_disabled() -> Dict[str, Any]:
    """CIS 3.1.2 — ICMP redirect sending must be disabled."""
    return _proc_net_eq(
        f"{_PROC_IPV4}/conf/all/send_redirects", "0",
        "3.1.2", "ICMP Redirect Sending Disabled", 2,
        "ICMP redirect sending disabled",
        "ICMP redirect sending enabled — can misdirect traffic (MITM risk)",
        "Add 'net.ipv4.conf.all.send_redirects = 0' to /etc/sysctl.d/99-cis.conf",
    )


def check_icmp_broadcast_disabled() -> Dict[str, Any]:
    """CIS 3.2.2 — Broadcast ICMP (Smurf) must be ignored."""
    return _proc_net_eq(
        f"{_PROC_IPV4}/icmp_echo_ignore_broadcasts", "1",
        "3.2.2", "Broadcast ICMP (Smurf) Disabled", 1,
        "Broadcast ICMP ignored — Smurf amplification mitigated",
        "Broadcast ICMP accepted — Smurf DDoS amplification risk",
        "Add 'net.ipv4.icmp_echo_ignore_broadcasts = 1' to /etc/sysctl.d/99-cis.conf",
    )


# =============================================================================
# Password Policy  (CIS 5.4.x)
# =============================================================================

def check_password_min_days() -> Dict[str, Any]:
    """CIS 5.4.1 — PASS_MIN_DAYS must be ≥ 1."""
    return _login_defs_int(
        "PASS_MIN_DAYS", "5.4.1", "Password Minimum Age ≥ 1 Day", 1,
        lambda v: v >= 1, "≥ 1",
        "PASS_MIN_DAYS ≥ 1 — prevents rapid password reuse cycling",
        "PASS_MIN_DAYS too low — allows immediate password cycling to reuse old passwords",
        "Set 'PASS_MIN_DAYS 1' in /etc/login.defs",
    )


def check_password_max_days() -> Dict[str, Any]:
    """CIS 5.4.2 — PASS_MAX_DAYS must be ≤ 365."""
    return _login_defs_int(
        "PASS_MAX_DAYS", "5.4.2", "Password Maximum Age ≤ 365 Days", 1,
        lambda v: 1 <= v <= 365, "1–365",
        "PASS_MAX_DAYS within recommended range",
        "PASS_MAX_DAYS too high — passwords do not expire frequently enough",
        "Set 'PASS_MAX_DAYS 90' in /etc/login.defs",
    )


def check_password_warn_days() -> Dict[str, Any]:
    """CIS 5.4.3 — PASS_WARN_AGE must be ≥ 7."""
    return _login_defs_int(
        "PASS_WARN_AGE", "5.4.3", "Password Expiry Warning ≥ 7 Days", 1,
        lambda v: v >= 7, "≥ 7",
        "PASS_WARN_AGE gives users adequate warning before expiry",
        "PASS_WARN_AGE too low — users not warned before password expiry",
        "Set 'PASS_WARN_AGE 7' in /etc/login.defs",
    )


# =============================================================================
# File Permissions  (CIS 6.1.x)
# =============================================================================

def check_passwd_permissions() -> Dict[str, Any]:
    """CIS 6.1.2 — /etc/passwd must be 644 or more restrictive."""
    return _file_perms_max(
        _PASSWD, 0o644,
        "6.1.2", "/etc/passwd Permissions (≤ 644)", 3,
        "chmod 644 /etc/passwd && chown root:root /etc/passwd",
    )


def check_shadow_permissions() -> Dict[str, Any]:
    """CIS 6.1.3 — /etc/shadow must be 640 or more restrictive."""
    mode, status, reason = _file_mode(_SHADOW)
    if status == "success":
        ok = mode <= 0o640
        return _make_result(
            "6.1.3", "/etc/shadow Permissions (≤ 640)",
            STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
            3,
            f"/etc/shadow: {oct(mode)}",
            "Shadow file restricted — password hashes protected" if ok
            else f"Shadow file too permissive ({oct(mode)}) — hashes exposed",
            "os_stat", "high",
            "chmod 640 /etc/shadow && chown root:shadow /etc/shadow",
        )
    return _make_result(
        "6.1.3", "/etc/shadow Permissions (≤ 640)",
        status, 3, reason, reason, "os_stat", "none",
        "chmod 640 /etc/shadow && chown root:shadow /etc/shadow",
    )


def check_group_permissions() -> Dict[str, Any]:
    """CIS 6.1.4 — /etc/group must be 644 or more restrictive."""
    return _file_perms_max(
        _GROUP, 0o644,
        "6.1.4", "/etc/group Permissions (≤ 644)", 2,
        "chmod 644 /etc/group && chown root:root /etc/group",
    )


# =============================================================================
# User Account Checks  (CIS 6.2.x)
# =============================================================================

def check_no_empty_passwords() -> Dict[str, Any]:
    """CIS 6.2.1 — No account may have an empty password field in /etc/shadow."""
    try:
        empty: List[str] = []
        with open(_SHADOW, "r", encoding="utf-8") as fh:
            for line in fh:
                parts = line.strip().split(":")
                # Empty string in field[1] = no password set
                if len(parts) >= 2 and parts[1] == "":
                    empty.append(parts[0])
        ok = not empty
        return _make_result(
            "6.2.1", "No Empty Passwords",
            STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
            3,
            f"{len(empty)} account(s) with empty password field",
            "No accounts have empty passwords" if ok
            else f"Accounts with empty passwords: {', '.join(empty[:5])}",
            "shadow_parse", "high",
            "Set passwords: passwd <username>  or lock: passwd -l <username>",
        )
    except PermissionError:
        return _make_result(
            "6.2.1", "No Empty Passwords",
            STATUS_INSUFFICIENT_PRIVILEGE, 3,
            "Cannot read /etc/shadow — requires root",
            "Agent lacks privilege to read /etc/shadow",
            "shadow_parse", "none",
            "Run agent as root or with sudo to check shadow passwords",
        )
    except Exception as exc:
        return _make_result(
            "6.2.1", "No Empty Passwords",
            STATUS_QUERY_FAILED, 3,
            str(exc), str(exc), "shadow_parse", "none",
            "Verify /etc/shadow is accessible",
        )


def check_root_uid_only() -> Dict[str, Any]:
    """CIS 6.2.2 — root must be the only UID 0 account in /etc/passwd."""
    try:
        rogue: List[str] = []
        with open(_PASSWD, "r", encoding="utf-8") as fh:
            for line in fh:
                parts = line.strip().split(":")
                if len(parts) < 4:
                    continue
                try:
                    if int(parts[2]) == 0 and parts[0] != "root":
                        rogue.append(parts[0])
                except ValueError:
                    continue
        ok = not rogue
        return _make_result(
            "6.2.2", "Root is Only UID 0 Account",
            STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
            3,
            f"Non-root UID 0 accounts: {', '.join(rogue) if rogue else 'none'}",
            "Only root has UID 0" if ok
            else f"Unauthorised UID 0 accounts detected: {', '.join(rogue)}",
            "passwd_parse", "high",
            "Remove unauthorised UID 0 accounts or reassign their UID",
        )
    except PermissionError:
        return _make_result(
            "6.2.2", "Root is Only UID 0 Account",
            STATUS_INSUFFICIENT_PRIVILEGE, 3,
            "Cannot read /etc/passwd",
            "Insufficient privilege",
            "passwd_parse", "none",
            "Run agent with appropriate privileges",
        )
    except Exception as exc:
        return _make_result(
            "6.2.2", "Root is Only UID 0 Account",
            STATUS_QUERY_FAILED, 3,
            str(exc), str(exc), "passwd_parse", "none",
            "Verify /etc/passwd is accessible",
        )


# =============================================================================
# Package Security  (CIS 1.2.x)
# =============================================================================

def check_gpg_keys_configured() -> Dict[str, Any]:
    """
    CIS 1.2.1 — Package manager GPG keys must be configured.
    Primary:  /etc/apt/trusted.gpg.d/  (Debian-family)
    Fallback: rpm --version presence   (RHEL-family)
    """
    if os.path.isdir(_APT_GPG_DIR):
        try:
            keys = [f for f in os.listdir(_APT_GPG_DIR)
                    if f.endswith((".gpg", ".asc"))]
            ok = bool(keys)
            return _make_result(
                "1.2.1", "GPG Keys Configured (APT)",
                STATUS_COMPLIANT if ok else STATUS_NON_COMPLIANT,
                2,
                f"{len(keys)} GPG key file(s) in {_APT_GPG_DIR}",
                "APT GPG keys present — package integrity verifiable" if ok
                else "No GPG keys found — packages cannot be verified",
                "apt_gpg_dir", "high",
                "Restore distribution GPG keys via apt-key or signed-by in sources.list",
            )
        except OSError:
            pass

    out, status, _ = _safe_exec(["rpm", "--version"])
    if status == "success":
        return _make_result(
            "1.2.1", "GPG Keys Configured (RPM)",
            STATUS_COMPLIANT, 2,
            f"rpm: {out}",
            "RPM package manager with GPG support available",
            "rpm_version", "medium",
            "Verify GPG keys: rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-*",
        )

    return _make_result(
        "1.2.1", "GPG Keys Configured",
        STATUS_QUERY_FAILED, 2,
        "Neither apt trusted.gpg.d nor rpm detected",
        "Unable to determine package manager GPG configuration",
        "apt+rpm", "none",
        "Configure package manager GPG key verification",
    )


# =============================================================================
# Weighted Scoring  (pure Python — identical logic to day8, fully portable)
# =============================================================================

def calculate_weighted_score(controls: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Same formula as day8.calculate_weighted_score().
    (sum of compliant weights / total weights) × 100
    """
    total_w = comp_w = comp_n = non_comp_n = 0
    crit = high = mod = 0
    for c in controls:
        w = c.get("severity_weight", 1)
        total_w += w
        if c.get("status") == STATUS_COMPLIANT:
            comp_w += w
            comp_n += 1
        else:
            non_comp_n += 1
            if   w == 3: crit += 1
            elif w == 2: high += 1
            else:        mod  += 1
    score = round((comp_w / total_w) * 100, 2) if total_w else 0.0
    return {
        "weighted_score":         score,
        "compliant_count":        comp_n,
        "non_compliant_count":    non_comp_n,
        "total_controls_checked": len(controls),
        "total_weight":           total_w,
        "compliant_weight":       comp_w,
        "critical_failed":        crit,
        "high_failed":            high,
        "moderate_failed":        mod,
    }


def calculate_priority_controls(controls: List[Dict[str, Any]],
                                 top_n: int = 3) -> List[Dict[str, Any]]:
    """
    Same priority formula as day8.calculate_priority_controls():
    priority_score = severity_weight × exposure_impact × exploitability
    """
    # Risk factors per control — sourced from CIS Benchmark criticality ratings
    RISK: Dict[str, Dict[str, int]] = {
        "5.2.2":  {"exposure": 3, "exploitability": 3},   # Root SSH — direct access
        "5.2.11": {"exposure": 3, "exploitability": 3},   # Empty SSH passwords
        "6.2.1":  {"exposure": 3, "exploitability": 3},   # Empty local passwords
        "6.2.2":  {"exposure": 3, "exploitability": 3},   # Extra UID 0 — instant root
        "6.1.3":  {"exposure": 3, "exploitability": 2},   # Shadow exposed → offline crack
        "5.2.4":  {"exposure": 2, "exploitability": 3},   # Proto 1 — downgrade/MITM
        "5.2.5":  {"exposure": 2, "exploitability": 2},   # Brute force via SSH
        "4.1.2":  {"exposure": 2, "exploitability": 2},   # No audit trail
        "3.1.1":  {"exposure": 2, "exploitability": 2},   # IP forwarding → pivot
        "1.2.1":  {"exposure": 2, "exploitability": 1},   # No GPG → tampered packages
        "5.2.8":  {"exposure": 2, "exploitability": 1},   # Rhosts trust
        "6.1.2":  {"exposure": 1, "exploitability": 2},   # /etc/passwd writable
        "6.1.4":  {"exposure": 1, "exploitability": 1},   # /etc/group perms
        "4.2.1":  {"exposure": 1, "exploitability": 1},   # No syslog
        "5.4.1":  {"exposure": 1, "exploitability": 1},   # Min days
        "5.4.2":  {"exposure": 1, "exploitability": 1},   # Max days
        "5.4.3":  {"exposure": 1, "exploitability": 1},   # Warn days
        "3.1.2":  {"exposure": 1, "exploitability": 1},   # Redirect send
        "3.2.2":  {"exposure": 1, "exploitability": 1},   # Smurf
        "5.2.12": {"exposure": 1, "exploitability": 1},   # User env
    }
    non_compliant = [c for c in controls if c.get("status") != STATUS_COMPLIANT]
    scored = []
    for c in non_compliant:
        cid = c.get("control_id", "")
        w   = c.get("severity_weight", 1)
        f   = RISK.get(cid, {"exposure": 1, "exploitability": 1})
        scored.append({
            "control_id":       cid,
            "name":             c.get("name", ""),
            "priority_score":   w * f["exposure"] * f["exploitability"],
            "severity_weight":  w,
            "exposure_impact":  f["exposure"],
            "exploitability":   f["exploitability"],
            "status":           c.get("status", ""),
            "reason":           c.get("reason", ""),
            "remediation_hint": c.get("remediation_hint", ""),
            "details":          c.get("details", ""),
        })
    scored.sort(key=lambda x: x["priority_score"], reverse=True)
    return scored[:top_n]


# =============================================================================
# Main Collection Function
# =============================================================================

def collect_cis_compliance() -> Dict[str, Any]:
    """
    Run all CIS Linux Server benchmark checks.
    Returns identical schema to day8_cis_compliance.collect_cis_compliance():
      {"controls": [...], "compliance_score": {...}, "priority_focus": [...]}
    """
    tasks: List[Tuple] = [
        # SSH hardening
        (check_ssh_permit_root_login,       ()),
        (check_ssh_protocol,                ()),
        (check_ssh_max_auth_tries,          ()),
        (check_ssh_ignore_rhosts,           ()),
        (check_ssh_permit_empty_passwords,  ()),
        (check_ssh_permit_user_environment, ()),
        # Audit & logging
        (check_auditd_running,              ()),
        (check_syslog_running,              ()),
        # Network parameters
        (check_ip_forwarding_disabled,      ()),
        (check_send_redirects_disabled,     ()),
        (check_icmp_broadcast_disabled,     ()),
        # Password policy
        (check_password_min_days,           ()),
        (check_password_max_days,           ()),
        (check_password_warn_days,          ()),
        # File permissions
        (check_passwd_permissions,          ()),
        (check_shadow_permissions,          ()),
        (check_group_permissions,           ()),
        # User accounts
        (check_no_empty_passwords,          ()),
        (check_root_uid_only,               ()),
        # Package security
        (check_gpg_keys_configured,         ()),
    ]

    print("Starting CIS Linux Server compliance assessment")
    spinner = TerminalSpinner("Scanning CIS controls...", total=len(tasks))
    spinner.start()

    controls: List[Dict[str, Any]] = []
    for func, args in tasks:
        try:
            controls.append(func(*args))
        except Exception as exc:
            logger.exception("Error in %s: %s", func.__name__, exc)
        finally:
            spinner.advance()

    spinner.stop()
    logger.info("CIS Linux assessment complete: %d controls checked", len(controls))

    return {
        "controls":         controls,
        "compliance_score": calculate_weighted_score(controls),
        "priority_focus":   calculate_priority_controls(controls, top_n=3),
    }


# =============================================================================
# Quick self-test
# =============================================================================
if __name__ == "__main__":
    import json
    result = collect_cis_compliance()
    print(json.dumps({
        "compliance_score": result["compliance_score"],
        "priority_focus":   result["priority_focus"],
        "controls_count":   len(result["controls"]),
    }, indent=2))
