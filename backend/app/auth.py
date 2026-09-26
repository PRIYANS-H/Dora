import os
import uuid
import smtplib
import random
from datetime import datetime, timedelta
from email.message import EmailMessage
from fastapi import APIRouter, HTTPException, Body
from passlib.context import CryptContext
import jwt

from app.database import get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", os.getenv("SUPABASE_KEY")) # Fallback
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
        print(f"Failed to send email (SMTP error): {e}")
        print(f"--- [DEVELOPMENT FALLBACK] OTP CODE: {otp} ---")
        # We won't raise 500 here so you can still test the flow using the OTP printed above!
        # raise HTTPException(status_code=500, detail="Failed to send verification email.")

def create_jwt(user_id: str, email: str):
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


@router.post("/signup")
def signup(payload: dict = Body(...)):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    sb = get_supabase()
    
    # Check if user exists in our custom table
    existing = sb.table("custom_users").select("id, is_verified").eq("email", email).execute()
    if existing.data:
        if existing.data[0]["is_verified"]:
            raise HTTPException(status_code=400, detail="User already exists. Please login.")
        user_id = existing.data[0]["id"]
    else:
        user_id = str(uuid.uuid4())
        sb.table("custom_users").insert({
            "id": user_id,
            "email": email,
            "password_hash": pwd_context.hash(password),
            "is_verified": False
        }).execute()
        
    otp = str(random.randint(100000, 999999))
    sb.table("custom_users").update({
        "otp_code": otp,
        "otp_expires_at": (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    }).eq("id", user_id).execute()
    
    send_otp_email(email, otp)
    print(f"OTP generated for {email}: {otp}")
    return {"message": "OTP sent to email (or printed to logs)", "email": email}


@router.post("/verify")
def verify(payload: dict = Body(...)):
    email = payload.get("email")
    otp = payload.get("otp")
    
    sb = get_supabase()
    res = sb.table("custom_users").select("*").eq("email", email).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    user = res.data[0]
    if user["otp_code"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    # Supabase returns timezone-aware TIMESTAMPTZ, so strip tzinfo for comparison with utcnow
    expires_at = datetime.fromisoformat(user["otp_expires_at"].replace('Z', '+00:00')).replace(tzinfo=None)
    if expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP expired")
        
    sb.table("custom_users").update({"is_verified": True, "otp_code": None}).eq("id", user["id"]).execute()
    
    token = create_jwt(user["id"], user["email"])
    return {"access_token": token, "user": {"id": user["id"], "email": user["email"]}}


@router.post("/login")
def login(payload: dict = Body(...)):
    email = payload.get("email")
    password = payload.get("password")
    
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
