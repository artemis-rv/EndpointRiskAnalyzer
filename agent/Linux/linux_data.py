"""
linux_data.py
-------------
Assembles the complete Linux endpoint scan dict by calling:
  - linux_commands  (day1 + day2 + day6 + day7 equivalents)
  - linux_cis       (CIS Linux Server benchmark checks)

Returns the same top-level schema as the Windows pipeline so
agent.py, send_scan_to_backend(), and the backend model need no changes.

Key schema guarantee:
  {
    "metadata", "system", "security", "antivirus_posture",
    "software_inventory", "runtimes",
    "privilege_posture", "exposure_posture", "cis_compliance"
  }
"""

import os
import sys

# ---------------------------------------------------------------------------
# Ensure the Linux/ package directory is on sys.path regardless of how
# agent.py invokes this file.  os.path.dirname(__file__) is a fixed,
# non-user-supplied value — no injection risk.
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from linux_commands import (
    run_linux_scan,
    collect_privilege_posture,
    collect_exposure_posture,
)
from linux_cis import collect_cis_compliance


def build_linux_scan() -> dict:
    """
    Full Linux endpoint scan — mirrors the Windows run_agent() data pipeline.

    Stages:
      1. run_linux_scan()           → metadata, system, security, AV, software, runtimes
      2. collect_privilege_posture()→ privilege_posture
      3. collect_exposure_posture() → exposure_posture
      4. collect_cis_compliance()   → cis_compliance

    Returns:
        dict matching the Windows scan schema for backend compatibility.
    """
    scan: dict = run_linux_scan()
    scan["privilege_posture"] = collect_privilege_posture()
    scan["exposure_posture"]  = collect_exposure_posture()
    scan["cis_compliance"]    = collect_cis_compliance()
    return scan


# ---------------------------------------------------------------------------
# Quick self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    result = build_linux_scan()
    # Print only top-level keys and the CIS score — avoid dumping full inventory
    summary = {
        "top_level_keys":   list(result.keys()),
        "system":           result.get("system"),
        "cis_score":        result.get("cis_compliance", {}).get("compliance_score"),
        "privilege":        result.get("privilege_posture"),
    }
    print(json.dumps(summary, indent=2))
