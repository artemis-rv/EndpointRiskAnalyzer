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

import day1         #remove this (in github)
import day2
import day3
import day4
import json
import day6_priv_posture as d6
import day7_exposure as d7

import day5_anomaly_detect

import os
import socket
from datetime import datetime

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
    print(json.dumps(scan, indent=2))


    return scan

#Day 5: llm explain
#training model: (should not be here)
    


if __name__ == "__main__":

    result = run_agent()

    # Ensure scans directory exists
    # os.makedirs("scans", exist_ok=True)

    # hostname = socket.gethostname()
    # timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # # filename = f"../scans/scan_{hostname}_{timestamp}.json"
    # filename = f"scans/ScanV2/scan_{hostname}_{timestamp}.json"

    # with open(filename, "w") as f:
    #     json.dump(result, f, indent=2)

    # print(f"[+] Scan completed successfully")
    # print(f"[+] Output saved to: {filename}")
