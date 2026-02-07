#the main file

"""
agent.py
---------
Endpoint agent responsible for:
- Collecting local system & security data
- Engineering features
- Calculating explainable risk
- Writing structured JSON output to scans/

This file is the ONLY executable on endpoints.
"""

import day2
import day3
import day4
import json
import day6_priv_posture as d6
import day7_exposure as d7

# import day5_anomaly_detect

import os
import socket
import uuid
from datetime import datetime

# Persist endpoint ID so it stays the same across restarts (avoids hostname collisions)
ENDPOINT_ID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".endpoint_id")


def get_or_create_endpoint_id():
    """Generate endpoint ID once and persist it; return same ID on subsequent runs."""
    if os.path.isfile(ENDPOINT_ID_FILE):
        try:
            with open(ENDPOINT_ID_FILE, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            pass
    eid = str(uuid.uuid4())
    try:
        with open(ENDPOINT_ID_FILE, "w", encoding="utf-8") as f:
            f.write(eid)
    except Exception:
        pass
    return eid


def run_agent():
    # Day 1 + Day 2: data collection
    scan = {}
    # scan.update(day1.run_day1_scan())
    scan.update(day2.run_day2_scan())

    # Day 3: feature engineering
    features, risk = day3.extract_features(scan)
    scan["features"] = features

    # Day 4: risk scoring
    scan["risk_assessment"] = risk

    #Day 6: Privilege Posture
    scan["privilege_posture"]=d6.collect_privilege_posture()

    #Day 7: exposure check
    scan["exposure_posture"]=d7.collect_exposure_posture()
    # Output
    # print(json.dumps(scan, indent=2))


    return scan

#Day 5: llm explain
#training model: (should not be here)
    


import requests

SCANS_URL = "http://127.0.0.1:8000/api/scans/"
# SCANS_URL = "http://192.168.56.1:8000/api/scans/"

def send_scan_to_backend(scan_data: dict, endpoint_id: str):
    """
    Sends collected scan data to backend API.
    Includes endpoint_id for association and hostname for display.
    """
    payload = dict(scan_data)
    payload["endpoint_id"] = endpoint_id
    payload["hostname"] = payload.get("hostname") or socket.gethostname()
    try:
        response = requests.post(
            SCANS_URL,
            json=payload,
            timeout=10
        )

        if response.status_code == 200:
            print("[+] Scan successfully sent to backend")
            print(response.json())
        else:
            print("[-] Backend rejected scan")
            print(response.status_code, response.text)

    except requests.exceptions.RequestException as e:
        print("[-] Failed to connect to backend")
        print(str(e))


import time
import requests

BACKEND_URL = "http://127.0.0.1:8000"
# BACKEND_URL = "http://192.168.56.1:8000"
POLL_INTERVAL = 30  # seconds


def poll_for_jobs(endpoint_id):
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/agent/jobs/{endpoint_id}",
            timeout=5
        )
        return response.json()
    except Exception:
        return None


def mark_job_complete(job_id):
    try:
        requests.post(
            f"{BACKEND_URL}/api/agent/jobs/{job_id}/complete",
            timeout=5
        )
    except Exception:
        pass


def agent_main_loop(endpoint_id: str, hostname: str):
    print(f"[+] Agent started for endpoint: {hostname}")

    while True:
        send_heartbeat(endpoint_id)
        job = poll_for_jobs(endpoint_id)

        if job and job.get("job_type") == "RUN_SCAN":
            print("[+] Received RUN_SCAN job")

            scan_result = run_agent()
            send_scan_to_backend(scan_result, endpoint_id)
            mark_job_complete(job["job_id"])
            
        time.sleep(POLL_INTERVAL)


def register_agent(endpoint_id: str):
    payload = {
        "endpoint_id": endpoint_id,
        "hostname": socket.gethostname(),
        "os": os.name,
    }

    try:
        r = requests.post(
            f"{BACKEND_URL}/api/agent/register",
            json=payload,
            timeout=5
        )
        data = r.json() if r.text else {}
        if data.get("status") == "registered":
            print("[+] Agent registered with backend")
        else:
            print("[-] Agent registration failed:", data.get("message", r.text or r.status_code))
    except Exception as e:
        print("[-] Agent registration failed:", e)


def send_heartbeat(endpoint_id):
    try:
        requests.post(
            f"{BACKEND_URL}/api/agent/heartbeat/{endpoint_id}",
            timeout=3
        )
    except Exception:
        pass


if __name__ == "__main__":
    # Persistent endpoint ID (generated once, avoids hostname collisions)
    endpoint_id = get_or_create_endpoint_id()
    hostname = socket.gethostname()
    register_agent(endpoint_id)
    agent_main_loop(endpoint_id, hostname)



    # Ensure scans directory exists
    # os.makedirs("scans/ScanV2", exist_ok=True)

    # hostname = socket.gethostname()
    # timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # # filename = f"../scans/scan_{hostname}_{timestamp}.json"
    # filename = f"scans/ScanV2/scan_{hostname}_{timestamp}.json"

    # with open(filename, "w") as f:
    #     json.dump(result, f, indent=2)

    # print(f"[+] Scan completed successfully")
    # print(f"[+] Output saved to: {filename}")