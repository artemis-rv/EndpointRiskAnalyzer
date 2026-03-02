from fastapi import APIRouter, Body, HTTPException
import logging
import bleach

router = APIRouter(prefix="/api/contact", tags=["Contact"])
logger = logging.getLogger(__name__)

# Allowed HTML tags for sanitization (strictly none)
ALLOWED_TAGS = []
ALLOWED_ATTRIBUTES = {}

@router.post("/")
def submit_contact_form(payload: dict = Body(...)):
    """
    Receives inquiry from the frontend Contact page.
    Sanitizes the input against HTML/Script injection attacks.
    Returns success without storing the data to any database.
    """
    
    name = payload.get("name", "").strip()
    email = payload.get("email", "").strip()
    message = payload.get("message", "").strip()
    
    if not name or not email or not message:
        raise HTTPException(status_code=400, detail="All fields are required")
        
    # Apply strict sanitization using bleach
    # This strips <script>, <iframe>, and all other HTML tags
    sanitized_name = bleach.clean(name, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)
    sanitized_email = bleach.clean(email, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)
    sanitized_message = bleach.clean(message, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)
    
    # In a real system we would send this via SMTP
    # For this architecture, we successfully receive, sanitize, and discard 
    # to avoid DB storage per requirements
    
    logger.info(f"Received inquiry from {sanitized_email} (Name: {sanitized_name})")
    
    return {
        "status": "success",
        "message": "Inquiry received and processed safely."
    }
