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
# import day3
# import day4
import json
import day6_priv_posture as d6
import day7_exposure as d7
import day8_cis_compliance as d8

# import day5_anomaly_detect

import os
import socket
import uuid
from datetime import datetime

# Persist endpoint ID so it stays the same across restarts (avoids hostname collisions)
ENDPOINT_ID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".endpoint_id")
API_KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".api_key")


def get_api_key():
    """Retrieve the stored API key from disk, if available."""
    if os.path.isfile(API_KEY_FILE):
        try:
            with open(API_KEY_FILE, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            pass
    return ""



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
    # features, risk = day3.extract_features(scan)
    # scan["features"] = features

    # Day 4: risk scoring
    # scan["risk_assessment"] = risk

    #Day 6: Privilege Posture
    scan["privilege_posture"]=d6.collect_privilege_posture()

    #Day 7: exposure check
    scan["exposure_posture"]=d7.collect_exposure_posture()
    
    #Day 8: CIS Compliance
    scan["cis_compliance"]=d8.collect_cis_compliance()
    
    # Output
    # print(json.dumps(scan, indent=2))


    return scan

#Day 5: llm explain
#training model: (should not be here)
    


import requests
import time
import hmac
import hashlib
from datetime import timezone

from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
print(f"[*] Target Backend: {BACKEND_URL}")

SCANS_URL = f"{BACKEND_URL}/api/scans/"


def get_auth_headers():
    timestamp = datetime.now(timezone.utc).isoformat()
    nonce = str(uuid.uuid4())
    return {
        "Authorization": f"Bearer {get_api_key()}",
        "X-Timestamp": timestamp,
        "X-Nonce": nonce
    }

def verify_signature(job_id, timestamp_str, signature):
    api_key = get_api_key()
    message = f"{job_id}:{timestamp_str}".encode("utf-8")
    expected_signature = hmac.new(api_key.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_signature, signature)

def send_scan_to_backend(scan_data: dict, endpoint_id: str):
    """
    Sends collected scan data to backend API.
    Includes endpoint_id for association and hostname for display.
    """
    payload = dict(scan_data)
    payload["endpoint_id"] = endpoint_id
    
    # Extract hostname and os from system dict if not at top level
    system_info = payload.get("system", {})
    payload["hostname"] = payload.get("hostname") or system_info.get("hostname") or socket.gethostname()
    payload["os"] = payload.get("os") or system_info.get("os") or "Unknown"
    
    try:
        headers = get_auth_headers()
        response = requests.post(
            SCANS_URL,
            json=payload,
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            print("[+] Scan successfully sent to backend")
            print(response.json())
        else:
            print("[-] Backend rejected scan")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")

    except requests.exceptions.RequestException as e:
        print("[-] Failed to connect to backend")
        print(str(e))


def poll_and_heartbeat():
    try:
        headers = get_auth_headers()
        response = requests.post(
            f"{BACKEND_URL}/api/agent/poll",
            headers=headers,
            timeout=5
        )
        return response.json()
    except Exception:
        return None


def mark_job_complete(job_id):
    try:
        headers = get_auth_headers()
        requests.post(
            f"{BACKEND_URL}/api/agent/jobs/{job_id}/complete",
            headers=headers,
            timeout=5   
        )
    except Exception:
        pass


def agent_main_loop(endpoint_id: str, hostname: str):
    print(f"[+] Agent started for endpoint: {hostname}")

    poll_interval = 60  # Default secure poll interval

    while True:
        job = poll_and_heartbeat()

        if job and job.get("job_id"):
            job_id = job.get("job_id")
            timestamp = job.get("timestamp")
            signature = job.get("signature")

            if not signature or not verify_signature(job_id, timestamp, signature):
                print(f"[-] Security violation: Job signature verification failed for job {job_id}! Rejecting job.")
            elif job.get("job_type") == "RUN_SCAN":
                print("[+] Received RUN_SCAN job. Signature verified.")
                poll_interval = 10  # Temporarily speed up polling

                scan_result = run_agent()
                send_scan_to_backend(scan_result, endpoint_id)
                mark_job_complete(job_id)
                
                poll_interval = 60  # Reset poll interval
                poll_and_heartbeat()  # Immediate heartbeat after job completion

        time.sleep(poll_interval)


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
            api_key = data.get("api_key")
            if api_key:
                try:
                    with open(API_KEY_FILE, "w", encoding="utf-8") as f:
                        f.write(api_key)
                except Exception as e:
                    print("[-] Failed to save API key locally:", e)
        else:
            print("[-] Agent registration failed:", data.get("message", r.text or r.status_code))
    except Exception as e:
        print("[-] Agent registration failed:", e)

def send_heartbeat(endpoint_id):
    # Backward compatibility stub. Main loop now uses poll_and_heartbeat.
    try:
        headers = get_auth_headers()
        requests.post(
            f"{BACKEND_URL}/api/agent/heartbeat/{endpoint_id}",
            headers=headers,
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