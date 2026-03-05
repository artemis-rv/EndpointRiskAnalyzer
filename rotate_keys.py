from backend.db.mongo import endpoints_collection
import secrets
import os

def rotate_all_keys():
    """
    Invalidates all current API keys in the database.
    This forces every agent to re-register (or you must manually deliver new keys).
    Since agents in this project re-register automatically if registration is called,
    clearing the DB key and the local .api_key file is the safest way to recover from a leak.
    """
    print("[*] Rotating all API keys in the database...")
    
    # Update all endpoints with a new random key
    endpoints = list(endpoints_collection().find({}))
    
    for ep in endpoints:
        new_key = secrets.token_hex(32)
        endpoints_collection().update_one(
            {"_id": ep["_id"]},
            {"$set": {"api_key": new_key}}
        )
        print(f" [+] Rotated key for hostname: {ep.get('hostname', 'Unknown')}")

    print("\n[!] WARNING: You must now delete the '.api_key' file on your agents.")
    print("[!] Run the following command in your terminal/agent folder:")
    print("    rm agent/.api_key")
    print("\n[*] When you restart the agent, it will register again and fetch the new key.")

if __name__ == "__main__":
    rotate_all_keys()
