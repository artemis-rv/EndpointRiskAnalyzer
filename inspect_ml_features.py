
import sys
import os
import json
from backend.db.mongo import endpoint_scans_collection, get_mongo_client

# Add current directory to sys.path
sys.path.append(os.getcwd())

try:
    get_mongo_client()
    # Get latest scan
    scan = endpoint_scans_collection().find_one({}, sort=[("scan_time", -1)])
    
    if scan:
        scan_data = scan.get('scan_data', {})
        sec = scan_data.get('features', {})
        print(f"AV Enabled: {sec.get('av_enabled')}")
        print(f"Firewall Any Off: {sec.get('firewall_any_off')}")
        print(f"Full Scan Data Features: {json.dumps(sec, indent=2)}")
    else:
        print("No scans found.")
        
except Exception as e:
    print(f"Error: {e}")
