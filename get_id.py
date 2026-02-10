
import sys
import os
from backend.db.mongo import endpoint_scans_collection, get_mongo_client

# Add current directory to sys.path
sys.path.append(os.getcwd())

try:
    get_mongo_client()
    scan = endpoint_scans_collection().find_one()
    if scan:
        print(f"Endpoint ID: {scan.get('endpoint_id')}")
    else:
        print("No scans found")
except Exception as e:
    print(f"Error: {e}")
