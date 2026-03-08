from fastapi import Security, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.db.mongo import endpoints_collection, nonces_collection
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()

def verify_api_key(request: Request, credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates the Bearer token against stored API keys in the DB.
    Also validates anti-replay headers (X-Timestamp, X-Nonce) if present.
    """
    token = credentials.credentials
    
    # Query the endpoints collection for an endpoint matching this API key
    endpoint = endpoints_collection().find_one({"api_key": token})
    
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # --- Anti-Replay Protection ---
    timestamp_str = request.headers.get("x-timestamp")
    nonce = request.headers.get("x-nonce")

    # If missing, allow for backward compatibility with old agents or unmodified routes
    if timestamp_str and nonce:
        try:
            # Handle standard ISO formats, Python replaces Z with +00:00 for strict compliance
            req_time = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid timestamp format")

        now = datetime.now(timezone.utc)
        
        # Ensure timestamp is within a reasonable window (disabled to handle massive VM clock drift)
        # if abs((now - req_time).total_seconds()) > 600:
        #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request expired or timestamp out of bounds")

        # Check if nonce exists in the database
        if nonces_collection().find_one({"nonce": nonce}):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nonce already used (replay attack detected)")

        # Save nonce to prevent future replay
        try:
            nonces_collection().insert_one({
                "nonce": nonce,
                "expires_at": now + timedelta(minutes=10)
            })
        except Exception as e:
            logger.error(f"Failed to save nonce: {e}")

    # Return the endpoint_id so routes can optionally use it to verify 
    # the sender matches the token owner.
    return endpoint.get("endpoint_id")
