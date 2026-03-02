from fastapi import Security, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.db.mongo import endpoints_collection

security = HTTPBearer()

def verify_api_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates the Bearer token against stored API keys in the DB.
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
    
    # Return the endpoint_id so routes can optionally use it to verify 
    # the sender matches the token owner.
    return endpoint.get("endpoint_id")
