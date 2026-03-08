from fastapi import APIRouter, Body, HTTPException
import logging
import bleach
import os
import smtplib
import ssl
from email.message import EmailMessage

router = APIRouter(prefix="/api/contact", tags=["Contact"])
logger = logging.getLogger(__name__)

# Allowed HTML tags for sanitization (strictly none)
ALLOWED_TAGS = []
ALLOWED_ATTRIBUTES = {}

def send_secure_email(name: str, user_email: str, message: str):
    """
    Sends an email using the configured SMTP server.
    """
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_username)
    smtp_to = os.getenv("SMTP_TO_EMAIL")

    if not all([smtp_server, smtp_username, smtp_password, smtp_to]):
        logger.error("SMTP configuration is incomplete. Cannot send email.")
        raise ValueError("SMTP configuration is incomplete.")

    msg = EmailMessage()
    msg.set_content(f"Name: {name}\nEmail: {user_email}\n\nMessage:\n{message}")
    msg["Subject"] = f"New Contact Inquiry from {name}"
    msg["From"] = smtp_from
    msg["Reply-To"] = user_email
    msg["To"] = smtp_to

    # Create a secure SSL context
    context = ssl.create_default_context()

    try:
        # Connect to the server
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_server, smtp_port, context=context) as server:
                server.login(smtp_username, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls(context=context)
                server.login(smtp_username, smtp_password)
                server.send_message(msg)
        logger.info(f"Successfully sent contact inquiry from {user_email}")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise e

@router.post("/")
def submit_contact_form(payload: dict = Body(...)):
    """
    Receives inquiry from the frontend Contact page.
    Sanitizes the input against HTML/Script injection attacks.
    Sends the inquiry via Secure SMTP.
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
    
    try:
        send_secure_email(sanitized_name, sanitized_email, sanitized_message)
    except ValueError as ve:
        # Configuration error
        raise HTTPException(status_code=500, detail="Server misconfigured for sending emails. Please contact administrator.")
    except Exception as e:
        # SMTP error
        raise HTTPException(status_code=500, detail="Failed to send the inquiry due to an internal server error.")
    
    return {
        "status": "success",
        "message": "Inquiry received and processed safely."
    }
