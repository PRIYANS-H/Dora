
import re
import os
import uuid
import hmac
import hashlib
import requests
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header, Body
from cryptography.fernet import Fernet, InvalidToken
from postgrest.exceptions import APIError
import cloudinary
import cloudinary.utils

from app import schemas
from app.database import get_supabase
from app.security import get_current_user, get_optional_user
from app.auth import send_product_email

router = APIRouter(tags=["profiles", "community", "catalog"])
USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,24}$")


def _secret_cipher():
    key = os.getenv("DORI_SECRET_ENCRYPTION_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Secure payment credential storage is not configured.")
    try:
        return Fernet(key.encode())
    except Exception:
        raise HTTPException(status_code=503, detail="DORI_SECRET_ENCRYPTION_KEY must be a valid Fernet key.")


def _decrypt_secret(value):
    try:
        return _secret_cipher().decrypt(value.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=503, detail="Stored payment credentials cannot be decrypted. Check the server encryption key.")


def _own_tailor(sb, profile_id):
    row = sb.table("tailors").select("id,profile_id").eq("profile_id", profile_id).maybe_single().execute().data
    if not row:
        raise HTTPException(status_code=409, detail="Link a professional tailor profile before configuring payments.")
    return row


def _public_payment_settings(row):
    if not row:
        return {"configured": False, "enabled": False, "key_id": "", "has_key_secret": False}
    return {"configured": True, "enabled": bool(row.get("enabled")), "key_id": row.get("key_id", ""), "has_key_secret": bool(row.get("encrypted_key_secret"))}


def _razorpay_settings_for_tailor(sb, tailor_id):
    row = sb.table("tailor_payment_settings").select("*").eq("tailor_id", tailor_id).eq("enabled", True).maybe_single().execute().data
    if not row:
        raise HTTPException(status_code=409, detail="This tailor has not enabled Razorpay payments yet.")
    return {
        "key_id": row["key_id"],
        "key_secret": _decrypt_secret(row["encrypted_key_secret"]),
        "webhook_secret": _decrypt_secret(row["encrypted_webhook_secret"]),
    }


def _razorpay_request(settings, method, endpoint, payload=None):
    try:
        response = requests.request(
            method,
            f"https://api.razorpay.com/v1/{endpoint.lstrip('/')}",
            auth=(settings["key_id"], settings["key_secret"]),
            json=payload,
            timeout=20,
        )
        data = response.json()
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Razorpay could not be reached. Try again shortly.")
    except ValueError:
        raise HTTPException(status_code=502, detail="Razorpay returned an invalid response.")
    if not response.ok:
        raise HTTPException(status_code=502, detail="Razorpay rejected the payment request. Check the tailor's test/live credentials.")
    return data


def _append_order_message(sb, order, sender_profile_id, body, quote_id=None):
    return sb.table("order_messages").insert({
        "order_id": order["id"], "sender_profile_id": sender_profile_id,
        "body": body[:5000], "quote_id": quote_id,
    }).execute().data[0]


def _mark_order_paid(sb, payment_row, payment_id):
    if payment_row.get("status") == "paid":
        return {"paid": True, "order_id": payment_row["order_id"]}
    order = sb.table("orders").select("*").eq("id", payment_row["order_id"]).maybe_single().execute().data
    if not order:
        raise HTTPException(status_code=404, detail="Payment order not found.")
    if order.get("status") != "awaiting_payment" or order.get("quoted_total_minor") != payment_row.get("amount_minor") or order.get("currency") != payment_row.get("currency"):
        raise HTTPException(status_code=409, detail="This payment is no longer for the current accepted quote.")
    accepted = sb.table("order_quotes").select("id").eq("order_id", order["id"]).eq("status", "accepted").eq("amount_minor", payment_row["amount_minor"]).eq("currency", payment_row["currency"]).limit(1).execute().data
    if not accepted:
        raise HTTPException(status_code=409, detail="There is no active accepted quote for this payment.")
    now = datetime.now(timezone.utc).isoformat()
    sb.table("payments").update({"status": "paid", "provider_payment_id": payment_id, "updated_at": now}).eq("id", payment_row["id"]).execute()
    sb.table("orders").update({"status": "paid", "updated_at": now}).eq("id", order["id"]).neq("status", "paid").execute()
    tailor = sb.table("tailors").select("profile_id").eq("id", order["tailor_id"]).maybe_single().execute().data or {}
    sender_id = tailor.get("profile_id") or order.get("customer_profile_id")
    if sender_id:
        _append_order_message(sb, order, sender_id, "Razorpay payment received. The order is ready to move into production.")
    if order.get("customer_profile_id"):
        _notify(sb, order["customer_profile_id"], "payment_received", "Payment received", "Your Razorpay payment was verified. The tailor can now begin production.", "/app/orders", f"payment:{payment_row['id']}:customer")
    if tailor.get("profile_id"):
        _notify(sb, tailor["profile_id"], "payment_received", "Order paid", "The customer’s Razorpay payment was verified.", "/app/messages", f"payment:{payment_row['id']}:tailor")
    return {"paid": True, "order_id": order["id"]}


@router.get("/media/signature")
def media_upload_signature(asset: str = Query("posts", pattern="^(avatars|posts|fabrics|tryon)$"), user=Depends(get_current_user)):
    if not cloudinary.config().api_secret or not cloudinary.config().cloud_name:
        raise HTTPException(status_code=503, detail="Image uploads are not configured yet.")
    folder = f"dori/{user['id']}/{asset}"
    timestamp = int(datetime.now(timezone.utc).timestamp())
    signature = cloudinary.utils.api_sign_request({"timestamp": timestamp, "folder": folder}, cloudinary.config().api_secret)
    return {"signature": signature, "timestamp": timestamp, "folder": folder, "cloud_name": cloudinary.config().cloud_name, "api_key": cloudinary.config().api_key}


@router.get("/settings/razorpay")
def get_razorpay_settings(user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    sb = get_supabase()
    tailor = _own_tailor(sb, profile["id"])
    row = sb.table("tailor_payment_settings").select("*").eq("profile_id", profile["id"]).maybe_single().execute().data
    return _public_payment_settings(row)


@router.put("/settings/razorpay")
def save_razorpay_settings(payload: schemas.RazorpaySettingsInput, user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    key_id = payload.key_id.strip()
    if not key_id.startswith(("rzp_test_", "rzp_live_")):
        raise HTTPException(status_code=422, detail="Enter a Razorpay test or live Key ID.")
    sb = get_supabase()
    tailor = _own_tailor(sb, profile["id"])
    existing = sb.table("tailor_payment_settings").select("encrypted_key_secret").eq("profile_id", profile["id"]).maybe_single().execute().data
    if not payload.key_secret and not (existing or {}).get("encrypted_key_secret"):
        raise HTTPException(status_code=422, detail="Enter the Razorpay Key Secret.")
    cipher = _secret_cipher()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "profile_id": profile["id"], "tailor_id": tailor["id"], "provider": "razorpay", "key_id": key_id,
        "encrypted_key_secret": cipher.encrypt(payload.key_secret.encode()).decode() if payload.key_secret else existing["encrypted_key_secret"],
        "encrypted_webhook_secret": "",
        "enabled": True, "updated_at": now,
    }
    saved = sb.table("tailor_payment_settings").upsert(row, on_conflict="profile_id").execute().data
    return _public_payment_settings(saved[0] if saved else row)


@router.delete("/settings/razorpay")
def disable_razorpay_settings(user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    result = get_supabase().table("tailor_payment_settings").update({"enabled": False, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("profile_id", profile["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Razorpay is not configured for this tailor profile.")
    return _public_payment_settings(result.data[0])


def _profile_for_user(user):
    result = get_supabase().table("profiles").select("*").eq("id", user["id"]).maybe_single().execute()
    return getattr(result, "data", None) if result else None


def _require_profile(user, professional=False):
    profile = _profile_for_user(user)
    if not profile:
        raise HTTPException(status_code=404, detail="Complete your DORI profile first.")
    if professional and not profile.get("is_professional"):
        raise HTTPException(status_code=403, detail="A professional account is required for this action.")
    return profile


def _require_order_participant(sb, order_id, user):
    profile = _require_profile(user)
    result = sb.table("orders").select("*").eq("id", order_id).maybe_single().execute()
    order = result.data
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    tailor = sb.table("tailors").select("profile_id").eq("id", order["tailor_id"]).maybe_single().execute()
    tailor_profile_id = (tailor.data or {}).get("profile_id")
    if order.get("customer_profile_id") != profile["id"] and tailor_profile_id != profile["id"]:
        raise HTTPException(status_code=403, detail="This order is not available to your account.")
    return profile, order, tailor_profile_id == profile["id"]


@router.get("/profiles")
def list_profiles(q: Optional[str] = Query(None, max_length=80), limit: int = Query(24, ge=1, le=60), offset: int = Query(0, ge=0)):
    query = get_supabase().table("profiles").select("id,username,full_name,bio,avatar_url,is_professional,skills,location,created_at").eq("is_professional", True).order("created_at", desc=True).range(offset, offset + limit - 1)
    if q and q.strip():
        query = query.ilike("username", f"%{q.strip()}%")
    result = query.execute()
    return result.data or []


@router.get("/profiles/username-available")
def username_available(username: str = Query(..., min_length=3, max_length=24)):
    normalized = username.strip().lower()
    if not USERNAME_PATTERN.fullmatch(normalized):
        return {"available": False, "reason": "Use 3-24 lowercase letters, numbers, or underscores."}
    result = get_supabase().table("profiles").select("id").eq("username", normalized).limit(1).execute()
    return {"available": not bool(result.data)}


@router.get("/profiles/me")
def get_my_profile(user=Depends(get_current_user)):
    profile = _profile_for_user(user)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile


@router.post("/profiles/me", response_model=schemas.ProfilePublic, status_code=201)
def create_my_profile(payload: schemas.ProfileCreate, user=Depends(get_current_user)):
    try:
        username = payload.username.strip().lower()
        if not USERNAME_PATTERN.fullmatch(username):
            raise HTTPException(status_code=422, detail="Username must be 3-24 lowercase letters, numbers, or underscores.")
        sb = get_supabase()
        if _profile_for_user(user):
            raise HTTPException(status_code=409, detail="Your profile already exists.")
        if payload.is_professional and (payload.latitude is None or payload.longitude is None):
            raise HTTPException(status_code=422, detail="Add your workshop latitude and longitude to create a professional account.")
        row = {
            "id": user["id"], "username": username, "full_name": payload.full_name.strip(),
            "email": user.get("email", ""), "bio": payload.bio.strip(), "avatar_url": payload.avatar_url,
            "is_professional": payload.is_professional, "skills": [s.strip()[:60] for s in payload.skills if s.strip()][:30], "location": payload.location,
            "latitude": payload.latitude, "longitude": payload.longitude,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if not row["full_name"]:
            raise HTTPException(status_code=422, detail="Name is required.")
        try:
            result = sb.table("profiles").insert(row).execute()
        except APIError as exc:
            if "23505" in str(exc) or "duplicate" in str(exc).lower():
                raise HTTPException(status_code=409, detail="That username is already taken.")
            raise HTTPException(status_code=400, detail="Could not create profile.")
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Profile inserted but no data returned from database.")
            
        profile = result.data[0]
        if payload.is_professional:
            try:
                sb.table("tailors").upsert({"id": f"dori-{profile['id']}", "profile_id": profile["id"], "name": profile["full_name"], "photo_url": profile.get("avatar_url") or "", "skills": profile["skills"], "lat": payload.latitude, "lng": payload.longitude, "rating": 0, "reviews_count": 0, "price_band": "custom", "portfolio_tags": profile["skills"]}).execute()
            except Exception as exc:
                print(f"[create_my_profile] Warning: Failed to upsert tailor for {profile['id']}: {exc}")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.patch("/profiles/me")
def update_my_profile(payload: schemas.ProfileUpdate, user=Depends(get_current_user)):
    current = _require_profile(user)
    changes = payload.model_dump(exclude_unset=True)
    if "username" in changes:
        username = (changes["username"] or "").strip().lower()
        if not USERNAME_PATTERN.fullmatch(username):
            raise HTTPException(status_code=422, detail="Username must be 3-24 lowercase letters, numbers, or underscores.")
        collision = get_supabase().table("profiles").select("id").eq("username", username).limit(1).execute().data or []
        if collision and collision[0]["id"] != current["id"]:
            raise HTTPException(status_code=409, detail="That username is already taken.")
        changes["username"] = username
    if "full_name" in changes:
        changes["full_name"] = (changes["full_name"] or "").strip()
        if not changes["full_name"]:
            raise HTTPException(status_code=422, detail="Name cannot be empty.")
    if "bio" in changes:
        changes["bio"] = (changes["bio"] or "").strip()
    if "skills" in changes:
        changes["skills"] = [s.strip()[:60] for s in (changes["skills"] or []) if s.strip()][:30]
    if "phone_number" in changes:
        changes["phone_number"] = (changes["phone_number"] or "").strip()[:32] or None
    is_professional = changes.get("is_professional", current.get("is_professional", False))
    latitude = changes.get("latitude", current.get("latitude"))
    longitude = changes.get("longitude", current.get("longitude"))
    if is_professional and (latitude is None or longitude is None):
        raise HTTPException(status_code=422, detail="Add your workshop latitude and longitude to enable the professional shop and orders.")
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    sb = get_supabase()
    result = sb.table("profiles").update(changes).eq("id", current["id"]).execute()
    updated = result.data[0] if result.data else {**current, **changes}
    if is_professional:
        tailor_row = {"id": f"dori-{current['id']}", "profile_id": current["id"], "name": updated["full_name"], "photo_url": updated.get("avatar_url") or "", "skills": updated.get("skills") or [], "lat": latitude, "lng": longitude, "rating": 0, "reviews_count": 0, "price_band": "custom", "portfolio_tags": updated.get("skills") or []}
        linked = sb.table("tailors").select("id").eq("profile_id", current["id"]).maybe_single().execute().data
        if linked:
            sb.table("tailors").update({key: value for key, value in tailor_row.items() if key != "id"}).eq("profile_id", current["id"]).execute()
        else:
            sb.table("tailors").insert(tailor_row).execute()
    return updated


@router.get("/profiles/{username}")
def get_public_profile(username: str, user=Depends(get_optional_user)):
    sb = get_supabase()
    result = sb.table("profiles").select("id,username,full_name,bio,avatar_url,is_professional,skills,location,created_at").eq("username", username.lower()).maybe_single().execute()
    if not result.data:
        # The seed tailor profile remains public until a seller claims a DORI account.
        tailor = sb.table("tailors").select("id,name,photo_url,skills,portfolio_tags,rating,reviews_count,price_band").eq("id", username.lower()).maybe_single().execute()
        if not tailor.data:
            raise HTTPException(status_code=404, detail="Profile not found.")
        return {"id": tailor.data["id"], "username": tailor.data["id"], "full_name": tailor.data["name"], "avatar_url": tailor.data["photo_url"], "bio": " · ".join(tailor.data.get("skills") or []), "is_professional": True, "skills": tailor.data.get("skills") or [], "rating": tailor.data.get("rating"), "reviews_count": tailor.data.get("reviews_count"), "price_band": tailor.data.get("price_band"), "portfolio_tags": tailor.data.get("portfolio_tags") or [], "followers_count": 0}
    profile = result.data
    try:
        profile["followers_count"] = sb.table("follows").select("follower_profile_id", count="exact", head=True).eq("followed_profile_id", profile["id"]).execute().count or 0
        profile["following_count"] = sb.table("follows").select("followed_profile_id", count="exact", head=True).eq("follower_profile_id", profile["id"]).execute().count or 0
    except Exception as e:
        print(f"[DORI] Could not load follow counts: {e}")
        profile["followers_count"] = 0
        profile["following_count"] = 0
    if profile.get("is_professional"):
        tailor = sb.table("tailors").select("rating,reviews_count,price_band,portfolio_tags").eq("profile_id", profile["id"]).maybe_single().execute().data
        if tailor:
            profile["rating"] = tailor.get("rating")
            profile["reviews_count"] = tailor.get("reviews_count")
            profile["price_band"] = tailor.get("price_band")
            profile["portfolio_tags"] = tailor.get("portfolio_tags") or []
    return profile


def _follow_target(username):
    sb = get_supabase()
    result = sb.table("profiles").select("id,username").eq("username", username.lower()).maybe_single().execute()
    if result.data:
        return result.data
    tailor = sb.table("tailors").select("profile_id").eq("id", username.lower()).maybe_single().execute()
    profile_id = (tailor.data or {}).get("profile_id")
    return {"id": profile_id, "username": username} if profile_id else None


@router.get("/profiles/{username}/follow")
def get_follow_state(username: str, user=Depends(get_optional_user)):
    if not user:
        return {"following": False}
    follower = _require_profile(user)
    target = _follow_target(username)
    if not target:
        return {"following": False}
    row = get_supabase().table("follows").select("follower_profile_id").eq("follower_profile_id", follower["id"]).eq("followed_profile_id", target["id"]).limit(1).execute()
    return {"following": bool(row.data)}


@router.put("/profiles/{username}/follow")
def follow_profile(username: str, user=Depends(get_current_user)):
    follower = _require_profile(user)
    target = _follow_target(username)
    if not target:
        raise HTTPException(status_code=404, detail="This professional profile is not linked to a DORI account yet.")
    if target["id"] == follower["id"]:
        raise HTTPException(status_code=409, detail="You cannot follow your own profile.")
    sb = get_supabase()
    sb.table("follows").upsert({"follower_profile_id": follower["id"], "followed_profile_id": target["id"]}, on_conflict="follower_profile_id,followed_profile_id").execute()
    return {"following": True}


@router.delete("/profiles/{username}/follow")
def unfollow_profile(username: str, user=Depends(get_current_user)):
    follower = _require_profile(user)
    target = _follow_target(username)
    if not target:
        raise HTTPException(status_code=404, detail="This professional profile is not linked to a DORI account yet.")
    get_supabase().table("follows").delete().eq("follower_profile_id", follower["id"]).eq("followed_profile_id", target["id"]).execute()
    return {"following": False}


@router.post("/posts/generate-caption")
def generate_caption(payload: schemas.CaptionGenerateRequest, user=Depends(get_current_user)):
    _require_profile(user, professional=True)
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=503, detail="Gemini API key is not configured.")
    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        prompt_text = (
            f"Generate a short, engaging, and professional fashion caption for a garment. "
            f"Title: {payload.title}. "
            f"Type: {payload.garment_type}. Attributes: {payload.base_attributes}."
        )
        response = client.models.generate_content(
            model='gemini-3.8-flash',
            contents=prompt_text,
        )
        if not response or not response.text:
            raise HTTPException(status_code=502, detail="The caption service returned an empty response.")
        return {"caption": response.text.strip()[:3000]}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error generating caption")


@router.post("/posts", response_model=schemas.PostResponse, status_code=201)
def create_post(payload: schemas.PostCreate, user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    if not payload.title.strip() or not payload.image_url.startswith(("https://", "http://")):
        raise HTTPException(status_code=422, detail="A title and valid image URL are required.")
    sb = get_supabase()
    tailor = sb.table("tailors").select("id").eq("profile_id", profile["id"]).maybe_single().execute()
    if not tailor.data:
        raise HTTPException(status_code=409, detail="Set your workshop location in Settings before publishing your first professional design.")
    starting_price = max(0, int(payload.starting_price_minor))
    row = {
        "id": str(uuid.uuid4()), "profile_id": profile["id"], "tailor_id": (tailor.data or {}).get("id"),
        "designer_name": profile["full_name"], "designer_handle": f"@{profile['username']}",
        "title": payload.title.strip()[:120], "caption": payload.caption.strip()[:3000],
        "image_url": payload.image_url, "garment_type": payload.garment_type.strip()[:80] or "custom",
        "base_attributes": payload.base_attributes, "price_reference": starting_price // 100,
        "starting_price_minor": starting_price, "currency": payload.currency.upper()[:3], "visibility": "public",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = sb.table("posts").insert(row).execute()
    return result.data[0]


@router.patch("/posts/{post_id}", response_model=schemas.PostResponse)
def update_post(post_id: str, payload: schemas.PostUpdate, user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    sb = get_supabase()
    post = sb.table("posts").select("id,profile_id").eq("id", post_id).maybe_single().execute()
    if not post.data:
        raise HTTPException(status_code=404, detail="Post not found.")
    if post.data.get("profile_id") != profile["id"]:
        raise HTTPException(status_code=403, detail="You cannot edit this post.")
    changes = payload.model_dump(exclude_unset=True)
    if "starting_price_minor" in changes:
        changes["price_reference"] = max(0, changes["starting_price_minor"] // 100)
    if "title" in changes:
        changes["title"] = changes["title"].strip()[:120]
    if "caption" in changes:
        changes["caption"] = changes["caption"].strip()[:3000]
    result = sb.table("posts").update(changes).eq("id", post_id).execute()
    return result.data[0]


@router.post("/tailors/{tailor_id}/collab-invite", status_code=201)
def send_collab_invite(tailor_id: str, payload: dict = Body(...), user=Depends(get_current_user)):
    """Share a design's full spec with a tailor so they can collaborate on / remix it."""
    sb = get_supabase()
    sender = _require_profile(user)
    tailor = sb.table("tailors").select("id,profile_id,name").eq("id", tailor_id).maybe_single().execute().data
    if not tailor:
        raise HTTPException(status_code=404, detail="Tailor not found.")
    if not tailor.get("profile_id"):
        raise HTTPException(status_code=409, detail="This tailor has not connected a DORI account yet.")

    post_id = payload.get("post_id")
    post = sb.table("posts").select("id,title,image_url,base_attributes,caption").eq("id", post_id).maybe_single().execute().data if post_id else None
    if not post:
        raise HTTPException(status_code=404, detail="Design not found.")

    attrs = payload.get("attributes") or post.get("base_attributes") or {}
    attr_summary = ", ".join(f"{k}: {v}" for k, v in attrs.items()) or "No custom attributes specified."
    body = (
        f"{sender.get('full_name', 'A DORI member')} shared \"{post['title']}\" with you for collaboration.\n"
        f"Design spec — {attr_summary}"
    )

    _notify(
        sb,
        tailor["profile_id"],
        "collab_invite",
        f"New design collaboration: {post['title']}",
        body,
        f"/app/?post={post['id']}",
        f"collab-{sender['id']}-{tailor['id']}-{post['id']}",
    )
    return {"sent": True, "tailor": tailor["name"], "post_title": post["title"]}


@router.get("/tailors/{tailor_id}/catalog")
def get_tailor_catalog(tailor_id: str):
    sb = get_supabase()
    tailor = sb.table("tailors").select("id,profile_id").eq("id", tailor_id).maybe_single().execute()
    if not tailor.data:
        raise HTTPException(status_code=404, detail="Tailor not found.")
    profile_id = tailor.data.get("profile_id")
    if not profile_id:
        return {"garments": [], "fabrics": []}
    garments = sb.table("garment_types").select("*").eq("profile_id", profile_id).eq("active", True).order("name").execute()
    fabrics = sb.table("fabrics").select("*").eq("profile_id", profile_id).eq("active", True).order("name").execute()
    return {"garments": garments.data or [], "fabrics": fabrics.data or []}


@router.get("/catalog/me")
def get_my_catalog(user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    sb = get_supabase()
    garments = sb.table("garment_types").select("*").eq("profile_id", profile["id"]).order("name").execute()
    fabrics = sb.table("fabrics").select("*").eq("profile_id", profile["id"]).order("name").execute()
    return {"garments": garments.data or [], "fabrics": fabrics.data or []}


@router.post("/catalog/garments", status_code=201)
def create_garment_type(payload: schemas.GarmentTypeInput, user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    if payload.category not in {"upper_body", "lower_body", "full_body", "accessory", "custom"}:
        raise HTTPException(status_code=422, detail="Choose a supported garment category.")
    row = {"profile_id": profile["id"], "name": payload.name.strip()[:80], "category": payload.category, "description": payload.description.strip()[:500], "active": payload.active}
    if payload.image_url:
        row["image_url"] = payload.image_url.strip()[:2000]
    if payload.post_id:
        row["post_id"] = payload.post_id
    result = get_supabase().table("garment_types").insert(row).execute()
    return result.data[0]


@router.patch("/catalog/garments/{garment_id}")
def update_garment_type(garment_id: str, payload: schemas.GarmentTypeInput, user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    if payload.category not in {"upper_body", "lower_body", "full_body", "accessory", "custom"}:
        raise HTTPException(status_code=422, detail="Choose a supported garment category.")
    data = {"name": payload.name.strip()[:80], "category": payload.category, "description": payload.description.strip()[:500], "active": payload.active}
    if payload.image_url is not None:
        data["image_url"] = payload.image_url.strip()[:2000] or None
    if payload.post_id is not None:
        data["post_id"] = payload.post_id or None
    result = get_supabase().table("garment_types").update(data).eq("id", garment_id).eq("profile_id", profile["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Garment type not found.")
    return result.data[0]


@router.post("/catalog/fabrics", status_code=201)
def create_fabric(payload: schemas.FabricInput, user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    if payload.price_delta_minor < 0 or payload.currency.upper() not in {"INR", "USD", "EUR", "GBP"}:
        raise HTTPException(status_code=422, detail="Enter a valid non-negative fabric price and supported currency.")
    values = payload.model_dump()
    values.update({"profile_id": profile["id"], "name": payload.name.strip()[:100], "currency": payload.currency.upper()})
    result = get_supabase().table("fabrics").insert(values).execute()
    return result.data[0]


@router.patch("/catalog/fabrics/{fabric_id}")
def update_fabric(fabric_id: str, payload: schemas.FabricInput, user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    if payload.price_delta_minor < 0 or payload.currency.upper() not in {"INR", "USD", "EUR", "GBP"}:
        raise HTTPException(status_code=422, detail="Enter a valid non-negative fabric price and supported currency.")
    values = payload.model_dump()
    values["name"] = values["name"].strip()[:100]
    values["currency"] = values["currency"].upper()
    result = get_supabase().table("fabrics").update(values).eq("id", fabric_id).eq("profile_id", profile["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Fabric not found.")
    return result.data[0]


@router.put("/posts/{post_id}/fabrics")
def add_post_fabric(post_id: str, payload: dict, user=Depends(get_current_user)):
    profile = _require_profile(user, professional=True)
    sb = get_supabase()
    post = sb.table("posts").select("id,profile_id").eq("id", post_id).maybe_single().execute()
    fabric_id = payload.get("fabric_id")
    fabric = sb.table("fabrics").select("id").eq("id", fabric_id).eq("profile_id", profile["id"]).eq("active", True).maybe_single().execute()
    if not post.data or post.data.get("profile_id") != profile["id"]:
        raise HTTPException(status_code=404, detail="Post not found.")
    if not fabric.data:
        raise HTTPException(status_code=404, detail="Active fabric not found in your shop.")
    result = sb.table("post_fabrics").upsert({"post_id": post_id, "fabric_id": fabric_id}, on_conflict="post_id,fabric_id").execute()
    return result.data[0] if result.data else {"post_id": post_id, "fabric_id": fabric_id}


@router.get("/posts/{post_id}/engagement")
def get_post_engagement(post_id: str, user=Depends(get_optional_user)):
    sb = get_supabase()
    post = sb.table("posts").select("id").eq("id", post_id).maybe_single().execute()
    if not post.data:
        raise HTTPException(status_code=404, detail="Post not found.")
    likes = sb.table("post_likes").select("id", count="exact").eq("post_id", post_id).execute()
    comments = sb.table("post_comments").select("id", count="exact").eq("post_id", post_id).is_("deleted_at", "null").execute()
    liked = False
    if user:
        found = sb.table("post_likes").select("id").eq("post_id", post_id).eq("profile_id", user["id"]).limit(1).execute()
        liked = bool(found.data)
    return {"like_count": likes.count or 0, "comment_count": comments.count or 0, "liked": liked}


@router.put("/posts/{post_id}/like")
def like_post(post_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    _require_profile(user)
    if not sb.table("posts").select("id").eq("id", post_id).maybe_single().execute().data:
        raise HTTPException(status_code=404, detail="Post not found.")
    sb.table("post_likes").upsert({"post_id": post_id, "profile_id": user["id"]}, on_conflict="post_id,profile_id").execute()
    count = sb.table("post_likes").select("id", count="exact").eq("post_id", post_id).execute()
    return {"liked": True, "like_count": count.count or 0}


@router.delete("/posts/{post_id}/like")
def unlike_post(post_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    _require_profile(user)
    sb.table("post_likes").delete().eq("post_id", post_id).eq("profile_id", user["id"]).execute()
    count = sb.table("post_likes").select("id", count="exact").eq("post_id", post_id).execute()
    return {"liked": False, "like_count": count.count or 0}


@router.get("/posts/{post_id}/comments")
def list_post_comments(post_id: str, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    sb = get_supabase()
    if not sb.table("posts").select("id").eq("id", post_id).maybe_single().execute().data:
        raise HTTPException(status_code=404, detail="Post not found.")
    rows = sb.table("post_comments").select("id,post_id,profile_id,body,parent_id,created_at,profiles(username,full_name,avatar_url)").eq("post_id", post_id).is_("deleted_at", "null").order("created_at", desc=False).range(offset, offset + limit - 1).execute()
    return rows.data or []


@router.post("/posts/{post_id}/comments", status_code=201)
def create_post_comment(post_id: str, payload: schemas.CommentCreate, user=Depends(get_current_user)):
    body = payload.body.strip()
    if not body or len(body) > 2000:
        raise HTTPException(status_code=422, detail="Comments must contain 1-2000 characters.")
    sb = get_supabase()
    _require_profile(user)
    post = sb.table("posts").select("id").eq("id", post_id).maybe_single().execute()
    if not post.data:
        raise HTTPException(status_code=404, detail="Post not found.")
    if payload.parent_id:
        parent = sb.table("post_comments").select("id").eq("id", payload.parent_id).eq("post_id", post_id).is_("deleted_at", "null").maybe_single().execute().data
        if not parent:
            raise HTTPException(status_code=422, detail="Reply to an active comment on this post.")
    row = {"id": str(uuid.uuid4()), "post_id": post_id, "profile_id": user["id"], "body": body, "parent_id": payload.parent_id}
    result = sb.table("post_comments").insert(row).execute()
    return result.data[0]


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    comment = sb.table("post_comments").select("id,profile_id").eq("id", comment_id).maybe_single().execute()
    if not comment.data:
        raise HTTPException(status_code=404, detail="Comment not found.")
    profile = _require_profile(user)
    if comment.data["profile_id"] != user["id"] and not profile.get("is_moderator"):
        raise HTTPException(status_code=403, detail="You cannot delete this comment.")
    sb.table("post_comments").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", comment_id).execute()
    return {"deleted": True}


def _notify(sb, profile_id, kind, title, body, href, key):
    notification = sb.table("notifications").upsert({"profile_id": profile_id, "kind": kind, "title": title, "body": body, "href": href, "dedupe_key": key}, on_conflict="dedupe_key").execute().data
    if not notification:
        return
    profile = sb.table("profiles").select("email").eq("id", profile_id).maybe_single().execute().data or {}
    email = profile.get("email")
    if not email:
        return
    outbox = sb.table("notification_outbox").upsert({"notification_id": notification[0]["id"], "recipient_email": email, "subject": f"DORI: {title}", "body": body, "status": "pending"}, on_conflict="notification_id").execute().data
    if not outbox:
        return
    try:
        send_product_email(email, f"DORI: {title}", body)
        sb.table("notification_outbox").update({"status": "sent", "attempts": 1, "last_error": None}).eq("id", outbox[0]["id"]).execute()
    except Exception as exc:
        sb.table("notification_outbox").update({"status": "failed", "attempts": 1, "last_error": str(exc)[:500]}).eq("id", outbox[0]["id"]).execute()


@router.get("/measurements")
def list_measurement_profiles(user=Depends(get_current_user)):
    profile = _require_profile(user)
    result = get_supabase().table("measurement_profiles").select("*").eq("profile_id", profile["id"]).order("updated_at", desc=True).execute()
    return result.data or []


@router.post("/measurements", status_code=201)
def save_measurement_profile(payload: schemas.MeasurementProfileInput, user=Depends(get_current_user)):
    profile = _require_profile(user)
    if payload.fit_template not in {"womens", "mens", "custom"} or payload.unit not in {"cm", "in"}:
        raise HTTPException(status_code=422, detail="Choose a supported fit template and measurement unit.")
    if not payload.measurements or any(float(value) <= 0 or float(value) > 500 for value in payload.measurements.values()):
        raise HTTPException(status_code=422, detail="Enter positive measurements smaller than 500.")
    row = {**payload.model_dump(), "profile_id": profile["id"], "updated_at": datetime.now(timezone.utc).isoformat()}
    result = get_supabase().table("measurement_profiles").insert(row).execute()
    return result.data[0]


@router.patch("/measurements/{measurement_id}")
def update_measurement_profile(measurement_id: str, payload: schemas.MeasurementProfileInput, user=Depends(get_current_user)):
    profile = _require_profile(user)
    if payload.fit_template not in {"womens", "mens", "custom"} or payload.unit not in {"cm", "in"} or not payload.measurements:
        raise HTTPException(status_code=422, detail="Choose a supported fit template, unit, and measurement values.")
    if any(float(value) <= 0 or float(value) > 500 for value in payload.measurements.values()):
        raise HTTPException(status_code=422, detail="Enter positive measurements smaller than 500.")
    values = {**payload.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    result = get_supabase().table("measurement_profiles").update(values).eq("id", measurement_id).eq("profile_id", profile["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Measurement profile not found.")
    return result.data[0]


@router.delete("/measurements/{measurement_id}")
def delete_measurement_profile(measurement_id: str, user=Depends(get_current_user)):
    profile = _require_profile(user)
    result = get_supabase().table("measurement_profiles").delete().eq("id", measurement_id).eq("profile_id", profile["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Measurement profile not found.")
    return {"deleted": True}


@router.post("/orders", status_code=201)
def create_order(payload: schemas.OrderCreate, user=Depends(get_current_user)):
    profile = _require_profile(user)
    sb = get_supabase()
    remix = sb.table("remixes").select("id,post_id,attributes,remixed_image_url").eq("id", payload.remix_id).maybe_single().execute().data
    tailor = sb.table("tailors").select("id,name,profile_id").eq("id", payload.tailor_id).maybe_single().execute().data
    if not remix or not tailor:
        raise HTTPException(status_code=404, detail="The selected design or tailor is unavailable.")
    if not tailor.get("profile_id"):
        raise HTTPException(status_code=409, detail="This demo tailor has not connected a DORI account and cannot accept orders yet.")
    if remix.get("profile_id") and remix["profile_id"] != profile["id"]:
        raise HTTPException(status_code=403, detail="This remix belongs to another account.")
    measurements = payload.measurements
    if payload.measurement_profile_id:
        saved = sb.table("measurement_profiles").select("measurements,unit").eq("id", payload.measurement_profile_id).eq("profile_id", profile["id"]).maybe_single().execute().data
        if not saved:
            raise HTTPException(status_code=404, detail="Measurement profile not found.")
        measurements = {**saved["measurements"], "unit": saved["unit"]}
    if not measurements:
        raise HTTPException(status_code=422, detail="Add manual measurements before placing an order.")
    post = sb.table("posts").select("id,title,price_reference,starting_price_minor,currency,garment_type,base_attributes").eq("id", remix["post_id"]).maybe_single().execute().data
    fabric_snapshot = None
    if payload.fabric_id:
        fabric = sb.table("fabrics").select("id,name,description,composition,color,image_url,price_delta_minor,currency,available_quantity").eq("id", payload.fabric_id).eq("profile_id", tailor.get("profile_id")).eq("active", True).maybe_single().execute().data
        if not fabric:
            raise HTTPException(status_code=422, detail="That fabric is no longer available from this tailor.")
        if fabric.get("available_quantity") == 0:
            raise HTTPException(status_code=409, detail="That fabric is currently out of stock.")
        fabric_snapshot = fabric
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    shared_phone = payload.phone_number or (profile.get("phone_number") if profile.get("phone_visible_to_order_partners") else "")
    row = {"id": order_id, "remix_id": remix["id"], "tailor_id": tailor["id"], "customer_profile_id": profile["id"], "match_score": 0, "measurements": measurements, "status": "placed", "currency": (post or {}).get("currency", "INR"), "spec_snapshot": {"attributes": remix.get("attributes") or {}, "garment_type": payload.garment_type or (post or {}).get("garment_type", "custom"), "base_post": post or {}, "phone_number": shared_phone, "fabric": fabric_snapshot}, "customer_note": payload.customer_note[:2000], "created_at": now, "updated_at": now}
    created = sb.table("orders").insert(row).execute().data[0]
    _append_order_message(sb, created, profile["id"], f"Order request placed for {row['spec_snapshot']['garment_type']}. Please review my measurements and share a price proposal when ready.")
    if tailor.get("profile_id"):
        _notify(sb, tailor["profile_id"], "order_placed", "New order request", f"{profile['full_name']} requested {row['spec_snapshot']['garment_type']}.", "/app/tailor-orders", f"order:{order_id}:placed")
    return {**created, "remix": remix, "tailor": tailor, "post": post}


@router.get("/orders")
def list_orders(role: str = Query("all", pattern="^(all|customer|tailor)$"), user=Depends(get_current_user)):
    profile = _require_profile(user)
    sb = get_supabase()
    mine = [] if role == "tailor" else (sb.table("orders").select("*").eq("customer_profile_id", profile["id"]).order("created_at", desc=True).execute().data or [])
    tailor_ids = sb.table("tailors").select("id").eq("profile_id", profile["id"]).execute().data or []
    if role != "customer":
        for tailor in tailor_ids:
            mine.extend(sb.table("orders").select("*").eq("tailor_id", tailor["id"]).order("created_at", desc=True).execute().data or [])
    unique = {order["id"]: order for order in mine}
    return [_order_view(sb, order) for order in sorted(unique.values(), key=lambda x: x.get("created_at", ""), reverse=True)]


def _order_view(sb, order):
    remix = sb.table("remixes").select("id,post_id,attributes,remixed_image_url").eq("id", order["remix_id"]).maybe_single().execute().data if order.get("remix_id") else None
    tailor = sb.table("tailors").select("id,name,photo_url,profile_id").eq("id", order["tailor_id"]).maybe_single().execute().data if order.get("tailor_id") else None
    post_id = remix.get("post_id") if remix else order.get("post_id")
    post = sb.table("posts").select("id,title,price_reference,starting_price_minor,currency,garment_type,image_url").eq("id", post_id).maybe_single().execute().data if post_id else None
    quotes = sb.table("order_quotes").select("*").eq("order_id", order["id"]).order("revision", desc=True).execute().data or []
    return {**order, "remix": remix, "tailor": tailor, "post": post, "quotes": quotes}


@router.get("/orders/{order_id}")
def get_scoped_order(order_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    _, order, _ = _require_order_participant(sb, order_id, user)
    return _order_view(sb, order)


@router.post("/orders/{order_id}/approve")
def approve_order_request(order_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    profile, order, is_tailor = _require_order_participant(sb, order_id, user)
    if not is_tailor:
        raise HTTPException(status_code=403, detail="Only the assigned tailor can approve this request.")
    if order.get("status") != "placed":
        raise HTTPException(status_code=409, detail="This order request is no longer awaiting approval.")
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("orders").update({"status": "negotiating", "updated_at": now}).eq("id", order_id).execute().data[0]
    _append_order_message(sb, order, profile["id"], "I approve your order request. Let's confirm the final details and price here.")
    if order.get("customer_profile_id"):
        _notify(sb, order["customer_profile_id"], "order_approved", "Tailor approved your request", "Your tailor approved the request. Continue the discussion in Messages.", "/app/messages", f"order:{order_id}:approved")
    return _order_view(sb, updated)


@router.patch("/orders/{order_id}/status")
def change_order_status(order_id: str, payload: schemas.OrderStatusUpdate, user=Depends(get_current_user)):
    sb = get_supabase()
    profile, order, is_tailor = _require_order_participant(sb, order_id, user)
    if not is_tailor:
        raise HTTPException(status_code=403, detail="Only the assigned tailor can update production status.")
    allowed = {"paid": {"stitching"}, "accepted": {"stitching", "cancelled"}, "stitching": {"ready"}, "ready": {"delivered"}, "delivered": set(), "cancelled": set()}
    if payload.status not in allowed.get(order["status"], set()):
        raise HTTPException(status_code=409, detail="That order status change is not allowed.")
    updated = sb.table("orders").update({"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", order_id).execute().data[0]
    if order.get("customer_profile_id"):
        _notify(sb, order["customer_profile_id"], "order_status", "Order update", f"Your order is now {payload.status}.", "/app/orders", f"order:{order_id}:status:{payload.status}")
    return _order_view(sb, updated)


@router.get("/orders/{order_id}/messages")
def list_order_messages(order_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    _require_order_participant(sb, order_id, user)
    return sb.table("order_messages").select("*,profiles(username,full_name,avatar_url)").eq("order_id", order_id).order("created_at").execute().data or []


@router.post("/orders/{order_id}/messages", status_code=201)
def create_order_message(order_id: str, payload: schemas.OrderMessageCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    profile, order, is_tailor = _require_order_participant(sb, order_id, user)
    body = payload.body.strip()
    if not body or len(body) > 5000:
        raise HTTPException(status_code=422, detail="Messages must contain 1-5000 characters.")
    row = sb.table("order_messages").insert({"order_id": order_id, "sender_profile_id": profile["id"], "body": body}).execute().data[0]
    recipient = order.get("customer_profile_id")
    if is_tailor:
        recipient = sb.table("profiles").select("id").eq("id", order.get("customer_profile_id")).maybe_single().execute().data
        recipient = (recipient or {}).get("id")
    else:
        tailor = sb.table("tailors").select("profile_id").eq("id", order["tailor_id"]).maybe_single().execute().data
        recipient = (tailor or {}).get("profile_id")
    if recipient:
        _notify(sb, recipient, "order_message", "New order message", f"{profile['full_name']}: {body[:120]}", "/app/tailor-orders" if is_tailor else "/app/orders", f"message:{row['id']}")
    return row


@router.post("/orders/{order_id}/quotes", status_code=201)
def create_order_quote(order_id: str, payload: schemas.OrderQuoteCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    profile, order, is_tailor = _require_order_participant(sb, order_id, user)
    if not is_tailor:
        raise HTTPException(status_code=403, detail="Only the assigned tailor can send a price quote.")
    if order.get("status") not in {"placed", "negotiating", "awaiting_payment"}:
        raise HTTPException(status_code=409, detail="This order is no longer open for price negotiation.")
    active_payment = sb.table("payments").select("id").eq("order_id", order_id).in_("status", ["created", "pending"]).limit(1).execute().data
    if active_payment:
        raise HTTPException(status_code=409, detail="A Razorpay checkout is already open for this quote. Finish or cancel that checkout before changing the price.")
    if payload.amount_minor <= 0 or payload.currency.upper() not in {"INR", "USD", "EUR", "GBP"}:
        raise HTTPException(status_code=422, detail="Enter a positive price and supported currency.")
    prior = sb.table("order_quotes").select("revision").eq("order_id", order_id).order("revision", desc=True).limit(1).execute().data or []
    rev = (prior[0]["revision"] if prior else 0) + 1
    sb.table("order_quotes").update({"status": "superseded"}).eq("order_id", order_id).in_("status", ["proposed", "accepted"]).execute()
    quote = sb.table("order_quotes").insert({"order_id": order_id, "revision": rev, "proposed_by_profile_id": profile["id"], "amount_minor": payload.amount_minor, "currency": payload.currency.upper(), "estimated_days": payload.estimated_days, "message": payload.message[:1000]}).execute().data[0]
    sb.table("orders").update({"quoted_total_minor": payload.amount_minor, "currency": payload.currency.upper(), "status": "negotiating", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", order_id).execute()
    _append_order_message(sb, order, profile["id"], f"Price proposal #{rev}: {payload.currency.upper()} {payload.amount_minor / 100:.2f}. {payload.message[:900]}".strip(), quote["id"])
    _notify(sb, order["customer_profile_id"], "order_quote", "Tailor sent a price", "Review the proposed price and accept it to continue.", "/app/orders", f"quote:{quote['id']}")
    return quote


@router.post("/orders/{order_id}/quotes/{quote_id}/accept")
def accept_order_quote(order_id: str, quote_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    profile, order, _ = _require_order_participant(sb, order_id, user)
    if order.get("customer_profile_id") != profile["id"]:
        raise HTTPException(status_code=403, detail="Only the customer can accept a quote.")
    quote = sb.table("order_quotes").select("*").eq("id", quote_id).eq("order_id", order_id).maybe_single().execute().data
    if order.get("status") != "negotiating" or not quote or quote["status"] != "proposed":
        raise HTTPException(status_code=409, detail="This quote is no longer available.")
    sb.table("order_quotes").update({"status": "superseded"}).eq("order_id", order_id).eq("status", "accepted").execute()
    sb.table("order_quotes").update({"status": "accepted"}).eq("id", quote_id).execute()
    sb.table("orders").update({"quoted_total_minor": quote["amount_minor"], "currency": quote["currency"], "status": "awaiting_payment", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", order_id).execute()
    _append_order_message(sb, order, profile["id"], f"I accept price proposal #{quote['revision']} ({quote['currency']} {quote['amount_minor'] / 100:.2f}). I'm ready to pay through Razorpay.", quote["id"])
    tailor = sb.table("tailors").select("profile_id").eq("id", order["tailor_id"]).maybe_single().execute().data or {}
    if tailor.get("profile_id"):
        _notify(sb, tailor["profile_id"], "quote_accepted", "Customer accepted your price", "The customer accepted your proposal. Payment is pending.", "/app/tailor-orders", f"quote:{quote_id}:accepted")
    return {"accepted": True, "quote": quote}


@router.get("/notifications")
def list_notifications(user=Depends(get_current_user)):
    profile = _require_profile(user)
    return get_supabase().table("notifications").select("*").eq("profile_id", profile["id"]).order("created_at", desc=True).limit(50).execute().data or []


@router.post("/notifications/{notification_id}/read")
def read_notification(notification_id: str, user=Depends(get_current_user)):
    profile = _require_profile(user)
    result = get_supabase().table("notifications").update({"read_at": datetime.now(timezone.utc).isoformat()}).eq("id", notification_id).eq("profile_id", profile["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return result.data[0]


@router.post("/orders/{order_id}/checkout")
def checkout_order(order_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    profile, order, _ = _require_order_participant(sb, order_id, user)
    if order.get("customer_profile_id") != profile["id"]:
        raise HTTPException(status_code=403, detail="Only the customer can start payment.")
    if order.get("status") != "awaiting_payment" or not order.get("quoted_total_minor"):
        raise HTTPException(status_code=409, detail="The tailor must send a price quote before payment.")
    accepted = sb.table("order_quotes").select("id,amount_minor,currency,revision").eq("order_id", order_id).eq("status", "accepted").eq("amount_minor", order["quoted_total_minor"]).eq("currency", order["currency"]).limit(1).execute().data
    if not accepted:
        raise HTTPException(status_code=409, detail="Accept the current tailor quote before checkout.")
    quote = accepted[0]
    if quote["currency"] != "INR":
        raise HTTPException(status_code=422, detail="Razorpay checkout is currently configured for INR orders.")
    tailor = sb.table("tailors").select("profile_id").eq("id", order["tailor_id"]).maybe_single().execute().data or {}
    if not tailor.get("profile_id"):
        raise HTTPException(status_code=409, detail="This tailor has not linked a DORI professional account.")
    settings = _razorpay_settings_for_tailor(sb, order["tailor_id"])
    idempotency_key = f"dori:{order_id}:{quote['id']}"
    existing = sb.table("payments").select("*").eq("idempotency_key", idempotency_key).maybe_single().execute().data
    if existing and existing.get("provider_session_id"):
        razorpay_order = {"id": existing["provider_session_id"]}
    else:
        razorpay_order = _razorpay_request(settings, "POST", "orders", {
            "amount": quote["amount_minor"], "currency": quote["currency"],
            "receipt": f"dori{uuid.uuid4().hex[:32]}", "notes": {"dori_order_id": order_id, "dori_quote_id": quote["id"]},
        })
        if not razorpay_order.get("id"):
            raise HTTPException(status_code=502, detail="Razorpay did not return a checkout order.")
        if existing:
            sb.table("payments").update({"provider_session_id": razorpay_order["id"], "status": "created", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", existing["id"]).execute()
        else:
            payment_row = {"order_id": order_id, "provider": "razorpay", "provider_session_id": razorpay_order["id"], "amount_minor": quote["amount_minor"], "currency": quote["currency"], "status": "created", "idempotency_key": idempotency_key}
            existing = sb.table("payments").insert(payment_row).execute().data[0]
    customer = sb.table("profiles").select("full_name,email").eq("id", profile["id"]).maybe_single().execute().data or {}
    return {
        "key": settings["key_id"], "razorpay_order_id": razorpay_order["id"],
        "amount": quote["amount_minor"], "currency": quote["currency"],
        "name": "DORI tailor order", "description": f"Order {order_id[:8]} · quote #{quote['revision']}",
        "prefill": {"name": customer.get("full_name", ""), "email": customer.get("email", "")},
        "order_id": order_id,
    }


@router.post("/orders/{order_id}/payments/verify")
def verify_razorpay_payment(order_id: str, payload: schemas.RazorpayPaymentVerify, user=Depends(get_current_user)):
    sb = get_supabase()
    profile, order, _ = _require_order_participant(sb, order_id, user)
    if order.get("customer_profile_id") != profile["id"] or order.get("status") != "awaiting_payment":
        raise HTTPException(status_code=403, detail="Only the customer can verify payment for this order.")
    payment = sb.table("payments").select("*").eq("order_id", order_id).eq("provider", "razorpay").eq("provider_session_id", payload.razorpay_order_id).maybe_single().execute().data
    if not payment or payment["amount_minor"] != order["quoted_total_minor"] or payment["currency"] != order["currency"]:
        raise HTTPException(status_code=409, detail="The Razorpay order does not match the current accepted quote.")
    if order.get("status") != "awaiting_payment":
        raise HTTPException(status_code=409, detail="This order is no longer awaiting payment.")
    if payload.razorpay_order_id != payment["provider_session_id"]:
        raise HTTPException(status_code=400, detail="Razorpay order does not match.")
    tailor = sb.table("tailors").select("profile_id").eq("id", order["tailor_id"]).maybe_single().execute().data or {}
    settings = _razorpay_settings_for_tailor(sb, order["tailor_id"])
    expected = hmac.new(settings["key_secret"].encode(), f"{payment['provider_session_id']}|{payload.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Razorpay payment signature is invalid.")
    details = _razorpay_request(settings, "GET", f"payments/{payload.razorpay_payment_id}")
    if details.get("order_id") != payment["provider_session_id"] or int(details.get("amount", -1)) != payment["amount_minor"] or details.get("currency") != payment["currency"]:
        raise HTTPException(status_code=409, detail="Razorpay payment details do not match this order.")
    if details.get("status") == "authorized":
        details = _razorpay_request(settings, "POST", f"payments/{payload.razorpay_payment_id}/capture", {"amount": payment["amount_minor"], "currency": payment["currency"]})
    if details.get("status") != "captured":
        raise HTTPException(status_code=409, detail="Razorpay has not captured this payment yet. Refresh the order after capture.")
    return _mark_order_paid(sb, payment, payload.razorpay_payment_id)


@router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: Optional[str] = Header(None)):
    raw = await request.body()
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay webhook signature.")
    try:
        event_data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook body.")
    event_name = event_data.get("event")
    if event_name != "payment.captured":
        return {"received": True}
    entity = (((event_data.get("payload") or {}).get("payment") or {}).get("entity") or {})
    razorpay_order_id = entity.get("order_id")
    payment_id = entity.get("id")
    if not razorpay_order_id or not payment_id:
        raise HTTPException(status_code=400, detail="Razorpay capture event is missing payment details.")
    sb = get_supabase()
    payment = sb.table("payments").select("*").eq("provider", "razorpay").eq("provider_session_id", razorpay_order_id).maybe_single().execute().data
    if not payment:
        raise HTTPException(status_code=404, detail="DORI payment order was not found.")
    order = sb.table("orders").select("*").eq("id", payment["order_id"]).maybe_single().execute().data
    if not order:
        raise HTTPException(status_code=404, detail="DORI order was not found.")
    settings = _razorpay_settings_for_tailor(sb, order["tailor_id"])
    expected = hmac.new(settings["webhook_secret"].encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Razorpay webhook signature is invalid.")
    if int(entity.get("amount", -1)) != payment["amount_minor"] or entity.get("currency") != payment["currency"]:
        raise HTTPException(status_code=409, detail="Razorpay webhook amount does not match the order.")
    return _mark_order_paid(sb, payment, payment_id)
