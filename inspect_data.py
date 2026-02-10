
import sys
import os
import json
from datetime import datetime

# Add current directory to sys.path
sys.path.append(os.getcwd())

try:
    from backend.db.mongo import endpoint_scans_collection, get_mongo_client
    
    # Ensure connection
    get_mongo_client()
    
    # Get one scan
    scan = endpoint_scans_collection().find_one()
    
    if scan:
        # Convert ObjectId and datetime for printing
        scan['_id'] = str(scan['_id'])
        scan['endpoint_id'] = str(scan['endpoint_id'])
        if 'scan_time' in scan and isinstance(scan['scan_time'], datetime):
            scan['scan_time'] = scan['scan_time'].isoformat()
            
        print(json.dumps(scan, indent=2, default=str))
    else:
        print("No scans found in database.")
        
except Exception as e:
    print(f"Error: {e}")
