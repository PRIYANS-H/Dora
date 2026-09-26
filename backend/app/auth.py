import os
import uuid
import smtplib
import secrets
import hmac
from datetime import datetime, timedelta
from email.message import EmailMessage
from fastapi import APIRouter, HTTPException, Body
from passlib.context import CryptContext
import jwt

from app.database import get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)

def send_otp_email(to_email: str, otp: str):
    msg = EmailMessage()
    msg.set_content(f"Your DORI verification code is: {otp}\nIt expires in 10 minutes.")
    msg["Subject"] = "Verify your DORI account"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification email.")


def send_product_email(to_email: str, subject: str, body: str):
    """Send a transactional product notice using the configured SMTP account."""
    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = subject[:160]
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)

def create_jwt(user_id: str, email: str):
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="DORI JWT signing is not configured. Set SUPABASE_JWT_SECRET.")
    # Supabase PostgREST expects standard claims. 'sub' maps to auth.uid()
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "exp": datetime.utcnow() + timedelta(days=30),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _credentials(payload):
    email = str(payload.get("email") or "").strip().lower()
    password = payload.get("password")
    if not email or "@" not in email or not isinstance(password, str):
        raise HTTPException(status_code=422, detail="Enter a valid email and password.")
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password must be 72 bytes or fewer.")
    return email, password


def _new_otp():
    return f"{secrets.randbelow(900000) + 100000:06d}"


def _otp_matches(stored, supplied):
    return isinstance(stored, str) and isinstance(supplied, str) and hmac.compare_digest(stored, supplied)


@router.post("/lookup")
def lookup(payload: dict = Body(...)):
    """Lets the single email-first sign-in screen choose "welcome back" vs "create account"."""
    email = str(payload.get("email") or "").strip().lower()
    if "@" not in email or len(email) > 254:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    res = get_supabase().table("custom_users").select("is_verified").eq("email", email).limit(1).execute()
    if not res.data:
        return {"exists": False, "verified": False}
    return {"exists": True, "verified": bool(res.data[0].get("is_verified"))}


@router.post("/signup")
def signup(payload: dict = Body(...)):
    email, password = _credentials(payload)
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    
    sb = get_supabase()
    
    # Check if user exists in our custom table
    existing = sb.table("custom_users").select("id, is_verified").eq("email", email).execute()
    if existing.data:
        if existing.data[0]["is_verified"]:
            raise HTTPException(status_code=400, detail="User already exists. Please login.")
        user_id = existing.data[0]["id"]
        sb.table("custom_users").update({"password_hash": pwd_context.hash(password)}).eq("id", user_id).execute()
    else:
        user_id = str(uuid.uuid4())
        sb.table("custom_users").insert({
            "id": user_id,
            "email": email,
            "password_hash": pwd_context.hash(password),
            "is_verified": False
        }).execute()
        
    otp = _new_otp()
    sb.table("custom_users").update({
        "otp_code": otp,
        "otp_expires_at": (datetime.utcnow() + timedelta(minutes=10)).isoformat(),
        "otp_attempts": 0
    }).eq("id", user_id).execute()
    
    send_otp_email(email, otp)
    return {"message": "OTP sent to email", "email": email}


@router.post("/verify")
def verify(payload: dict = Body(...)):
    email = str(payload.get("email") or "").strip().lower()
    otp = payload.get("otp")
    
    sb = get_supabase()
    res = sb.table("custom_users").select("*").eq("email", email).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    user = res.data[0]
    attempts = int(user.get("otp_attempts") or 0)
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new code and try again.")
    if not _otp_matches(user.get("otp_code"), otp):
        sb.table("custom_users").update({"otp_attempts": attempts + 1}).eq("id", user["id"]).execute()
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    # Supabase returns timezone-aware TIMESTAMPTZ, so strip tzinfo for comparison with utcnow
    expires_at = datetime.fromisoformat(user["otp_expires_at"].replace('Z', '+00:00')).replace(tzinfo=None)
    if expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP expired")
        
    sb.table("custom_users").update({"is_verified": True, "otp_code": None, "otp_expires_at": None, "otp_attempts": 0}).eq("id", user["id"]).execute()
    
    token = create_jwt(user["id"], user["email"])
    return {"access_token": token, "user": {"id": user["id"], "email": user["email"]}}


@router.post("/login")
def login(payload: dict = Body(...)):
    email, password = _credentials(payload)
    
    sb = get_supabase()
    res = sb.table("custom_users").select("*").eq("email", email).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Invalid credentials")
        
    user = res.data[0]
    if not user["is_verified"]:
        raise HTTPException(status_code=400, detail="Please verify your email first")
        
    if not pwd_context.verify(password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")
        
    token = create_jwt(user["id"], user["email"])
    return {"access_token": token, "user": {"id": user["id"], "email": user["email"]}}


@router.post("/request-reset")
def request_reset(payload: dict = Body(...)):
    email = str(payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
        
    sb = get_supabase()
    res = sb.table("custom_users").select("id").eq("email", email).execute()
    if not res.data:
        return {"message": "If an account exists for that email, a password reset code has been sent."}
        
    user_id = res.data[0]["id"]
    otp = _new_otp()
    sb.table("custom_users").update({
        "otp_code": otp,
        "otp_expires_at": (datetime.utcnow() + timedelta(minutes=10)).isoformat(),
        "otp_attempts": 0
    }).eq("id", user_id).execute()
    
    send_otp_email(email, otp)
    return {"message": "Password reset OTP sent"}


@router.post("/confirm-reset")
def confirm_reset(payload: dict = Body(...)):
    email = str(payload.get("email") or "").strip().lower()
    otp = payload.get("otp")
    new_password = payload.get("new_password")
    
    if not email or not otp or not isinstance(new_password, str):
        raise HTTPException(status_code=400, detail="Missing fields")
    if len(new_password) < 8 or len(new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password must be 8-72 bytes long.")
        
    sb = get_supabase()
    res = sb.table("custom_users").select("*").eq("email", email).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    user = res.data[0]
    attempts = int(user.get("otp_attempts") or 0)
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new code and try again.")
    if not _otp_matches(user.get("otp_code"), otp):
        sb.table("custom_users").update({"otp_attempts": attempts + 1}).eq("id", user["id"]).execute()
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    expires_at = datetime.fromisoformat(user["otp_expires_at"].replace('Z', '+00:00')).replace(tzinfo=None)
    if expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP expired")
        
    sb.table("custom_users").update({
        "password_hash": pwd_context.hash(new_password),
        "otp_code": None,
        "otp_expires_at": None,
        "otp_attempts": 0
    }).eq("id", user["id"]).execute()
    
    return {"message": "Password updated successfully"}
