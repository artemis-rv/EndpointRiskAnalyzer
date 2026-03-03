"""
endpoint_service.py

Service layer for endpoint management.
"""
from datetime import datetime, timezone
import logging

from backend.db.mongo import endpoints_collection

logger = logging.getLogger(__name__)

def upsert_endpoint(hostname: str, os_name: str, agent_endpoint_id: str = None):
    """
    Creates or updates an endpoint record in the database.
    If agent_endpoint_id is provided, prefers matching by UUID.
    Otherwise matches by hostname.
    
    Returns:
        The endpoint_id (str) or MongoDB ObjectId of the updated or inserted endpoint.
    """
    if agent_endpoint_id:
        endpoint = endpoints_collection().find_one({"endpoint_id": agent_endpoint_id})
        if not endpoint:
            endpoints_collection().insert_one({
                "endpoint_id": agent_endpoint_id,
                "hostname": hostname,
                "os": os_name,
                "last_seen": datetime.now(timezone.utc),
            })
        else:
            endpoints_collection().update_one(
                {"endpoint_id": agent_endpoint_id},
                {"$set": {"last_seen": datetime.now(timezone.utc), "hostname": hostname, "os": os_name}}
            )
        return agent_endpoint_id
    else:
        endpoint = endpoints_collection().find_one({"hostname": hostname})
        if not endpoint:
            endpoint_doc = {
                "hostname": hostname,
                "os": os_name,
                "last_seen": datetime.now(timezone.utc)
            }
            inserted_id = endpoints_collection().insert_one(endpoint_doc).inserted_id
            return inserted_id
        else:
            endpoint_id_oid = endpoint["_id"]
            endpoints_collection().update_one(
                {"_id": endpoint_id_oid},
                {"$set": {"last_seen": datetime.now(timezone.utc)}}
            )
            return endpoint_id_oid

def is_agent_active(last_seen, threshold_seconds=120) -> bool:
    """
    True only if last_seen is in the past and within the specified threshold in seconds.
    Avoids timezone/future bugs.
    """
    from datetime import timedelta
    if not last_seen:
        return False
    if isinstance(last_seen, datetime):
        dt = last_seen
    else:
        try:
            dt = datetime.fromisoformat(str(last_seen).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return False
            
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
        
    now = datetime.now(timezone.utc)
    delta = now - dt
    
    # Active only if last_seen is in the past and within threshold (not in future, not too old)
    return timedelta(0) < delta < timedelta(seconds=threshold_seconds)
