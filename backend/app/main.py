import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import get_supabase
from app import schemas
from app.services.matcher import compute_tailor_match
from app.services.remix_engine import generate_remixed_image
from app.seed import seed_database
from app.auth import router as auth_router

app = FastAPI(title="DORI Fashion Remix & Tailoring Engine API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for remixed images
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(auth_router)


@app.on_event("startup")
def startup_event():
    """Auto-seed Supabase if tables are empty."""
    try:
        sb = get_supabase()
        try:
            sb.storage.create_bucket("avatars", options={"public": True})
            print("[DORI] Created Supabase avatars bucket.")
        except Exception as storage_error:
            if "already exists" not in str(storage_error).lower() and "duplicate" not in str(storage_error).lower():
                print(f"[DORI] Avatar bucket setup skipped: {storage_error}")
        result = sb.table("posts").select("id", count="exact").limit(1).execute()
        count = result.count if result.count is not None else len(result.data or [])
        if count == 0:
            print("[DORI] Seeding Supabase database…")
            seed_database()
            print("[DORI] Seed complete.")
        else:
            print(f"[DORI] Database already has data ({count} posts). Skipping seed.")
    except Exception as e:
        print(f"[DORI] Startup seed check failed: {e}. Run `python -m app.seed` manually.")


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "DORI API", "tagline": "See it. Remix it. Wear it.", "db": "Supabase Postgres"}


# ── 1. GET /posts ──────────────────────────────────────────────────────────────

@app.get("/posts", response_model=List[schemas.PostResponse])
def get_posts():
    sb = get_supabase()
    result = sb.table("posts").select("*").order("created_at", desc=False).execute()
    return result.data or []


# ── 2. GET /posts/{id} ─────────────────────────────────────────────────────────

@app.get("/posts/{id}", response_model=schemas.PostResponse)
def get_post(id: str):
    sb = get_supabase()
    result = sb.table("posts").select("*").eq("id", id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")
    return result.data


# ── 3. GET /remixes ────────────────────────────────────────────────────────────

@app.get("/remixes", response_model=List[schemas.RemixResponse])
def get_remixes():
    sb = get_supabase()
    result = sb.table("remixes").select("*").order("created_at", desc=True).execute()
    return result.data or []


# ── 4. POST /remix ─────────────────────────────────────────────────────────────

@app.post("/remix", response_model=schemas.RemixResponse)
def create_remix(payload: schemas.RemixCreate):
    sb = get_supabase()

    post_res = sb.table("posts").select("*").eq("id", payload.post_id).single().execute()
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Base post not found")
    post = post_res.data

    remixed_image_url = generate_remixed_image(
        post_id=post["id"],
        base_image_url=post["image_url"],
        base_attributes=post["base_attributes"],
        new_attributes=payload.attributes
    )

    remix_row = {
        "id": str(uuid.uuid4()),
        "post_id": post["id"],
        "user_label": "Demo User",
        "attributes": payload.attributes,
        "remixed_image_url": remixed_image_url,
        "created_at": datetime.utcnow().isoformat(),
    }
    insert_res = sb.table("remixes").insert(remix_row).execute()
    return insert_res.data[0]


# ── 5. GET /tailors/match + POST /tailors/match ────────────────────────────────

def _match_tailors_impl(
    attributes: Dict[str, str],
    lat: float,
    lng: float,
) -> List[schemas.TailorMatchResponse]:
    sb = get_supabase()
    result = sb.table("tailors").select("*").execute()
    tailors = result.data or []

    matched = []
    for t in tailors:
        match_data = compute_tailor_match(t, attributes, user_lat=lat, user_lng=lng)
        matched.append(schemas.TailorMatchResponse(
            id=t["id"],
            name=t["name"],
            photo_url=t["photo_url"],
            skills=t.get("skills") or [],
            lat=t["lat"],
            lng=t["lng"],
            rating=t["rating"],
            reviews_count=t.get("reviews_count", 0),
            price_band=t.get("price_band", "mid"),
            portfolio_tags=t.get("portfolio_tags") or [],
            match_score=match_data["match_score"],
            breakdown=schemas.SubScoreBreakdown(**match_data["breakdown"])
        ))

    matched.sort(key=lambda x: x.match_score, reverse=True)
    return matched[:3]


@app.get("/tailors/match", response_model=List[schemas.TailorMatchResponse])
def match_tailors_get(
    attributes_json: Optional[str] = Query(None),
    lat: float = Query(37.7749),
    lng: float = Query(-122.4194),
):
    import json
    attrs = {}
    if attributes_json:
        try:
            attrs = json.loads(attributes_json)
        except Exception:
            pass
    return _match_tailors_impl(attrs, lat, lng)


@app.post("/tailors/match", response_model=List[schemas.TailorMatchResponse])
def match_tailors_post(payload: schemas.TailorMatchRequest = Body(...)):
    return _match_tailors_impl(
        payload.attributes or {},
        payload.lat or 37.7749,
        payload.lng or -122.4194,
    )


# ── 6. POST /orders ────────────────────────────────────────────────────────────

@app.post("/orders", response_model=schemas.OrderResponse)
def create_order(payload: schemas.OrderCreate):
    sb = get_supabase()

    remix_res = sb.table("remixes").select("*").eq("id", payload.remix_id).single().execute()
    if not remix_res.data:
        raise HTTPException(status_code=404, detail="Remix not found")
    remix = remix_res.data

    tailor_res = sb.table("tailors").select("*").eq("id", payload.tailor_id).single().execute()
    if not tailor_res.data:
        raise HTTPException(status_code=404, detail="Tailor not found")
    tailor = tailor_res.data

    match_data = compute_tailor_match(tailor, remix["attributes"])

    order_row = {
        "id": str(uuid.uuid4()),
        "remix_id": remix["id"],
        "tailor_id": tailor["id"],
        "match_score": match_data["match_score"],
        "measurements": payload.measurements,
        "status": "placed",
        "created_at": datetime.utcnow().isoformat(),
    }
    insert_res = sb.table("orders").insert(order_row).execute()
    order = insert_res.data[0]

    post = None
    if remix.get("post_id"):
        post_res = sb.table("posts").select("id,title,designer_name,price_reference").eq("id", remix["post_id"]).single().execute()
        post = post_res.data

    return _build_order_response(order, remix, tailor, post)


# ── 7. GET /orders ─────────────────────────────────────────────────────────────

@app.get("/orders", response_model=List[schemas.OrderResponse])
def get_orders():
    sb = get_supabase()
    orders_res = sb.table("orders").select("*").order("created_at", desc=True).execute()
    orders = orders_res.data or []

    results = []
    for order in orders:
        remix, tailor, post = _fetch_order_relations(sb, order)
        results.append(_build_order_response(order, remix, tailor, post))
    return results


# ── 8. GET /orders/{id} ────────────────────────────────────────────────────────

@app.get("/orders/{id}", response_model=schemas.OrderResponse)
def get_order(id: str):
    sb = get_supabase()
    order_res = sb.table("orders").select("*").eq("id", id).single().execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = order_res.data
    remix, tailor, post = _fetch_order_relations(sb, order)
    return _build_order_response(order, remix, tailor, post)


# ── 9. PATCH /orders/{id}/status ──────────────────────────────────────────────

@app.patch("/orders/{id}/status", response_model=schemas.OrderResponse)
def update_order_status(id: str, payload: schemas.OrderStatusUpdate):
    valid_statuses = ["placed", "accepted", "stitching", "ready", "delivered"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    sb = get_supabase()
    order_res = sb.table("orders").select("*").eq("id", id).single().execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Order not found")

    sb.table("orders").update({"status": payload.status}).eq("id", id).execute()
    return get_order(id)


# ── 10. GET /orders/{id}/receipt ───────────────────────────────────────────────

@app.get("/orders/{id}/receipt", response_model=schemas.RoyaltyReceiptResponse)
def get_order_receipt(id: str):
    sb = get_supabase()
    order_res = sb.table("orders").select("*").eq("id", id).single().execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = order_res.data

    base_price = 300
    if order.get("remix_id"):
        remix_res = sb.table("remixes").select("post_id").eq("id", order["remix_id"]).single().execute()
        if remix_res.data and remix_res.data.get("post_id"):
            post_res = sb.table("posts").select("price_reference").eq("id", remix_res.data["post_id"]).single().execute()
            if post_res.data:
                base_price = post_res.data.get("price_reference", 300)

    return schemas.RoyaltyReceiptResponse(
        order_id=order["id"],
        price_reference=base_price,
        designer_amount=round(base_price * 0.15, 2),
        tailor_amount=round(base_price * 0.70, 2),
        platform_amount=round(base_price * 0.15, 2),
        designer_share_pct=15,
        tailor_share_pct=70,
        platform_share_pct=15,
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fetch_order_relations(sb, order):
    remix, tailor, post = None, None, None
    if order.get("remix_id"):
        remix_res = sb.table("remixes").select("*").eq("id", order["remix_id"]).single().execute()
        remix = remix_res.data
    if order.get("tailor_id"):
        tailor_res = sb.table("tailors").select("id,name,photo_url,price_band").eq("id", order["tailor_id"]).single().execute()
        tailor = tailor_res.data
    if remix and remix.get("post_id"):
        post_res = sb.table("posts").select("id,title,designer_name,price_reference").eq("id", remix["post_id"]).single().execute()
        post = post_res.data
    return remix, tailor, post


def _build_order_response(order, remix, tailor, post):
    return schemas.OrderResponse(
        id=order["id"],
        remix_id=order["remix_id"],
        tailor_id=order["tailor_id"],
        match_score=order["match_score"],
        measurements=order.get("measurements", {}),
        status=order["status"],
        created_at=order["created_at"],
        remix={
            "id": remix["id"],
            "attributes": remix.get("attributes", {}),
            "remixed_image_url": remix.get("remixed_image_url", ""),
        } if remix else None,
        tailor={
            "id": tailor["id"],
            "name": tailor["name"],
            "photo_url": tailor.get("photo_url", ""),
            "price_band": tailor.get("price_band", "mid"),
        } if tailor else None,
        post={
            "id": post["id"],
            "title": post["title"],
            "designer_name": post["designer_name"],
            "price_reference": post["price_reference"],
        } if post else None,
    )
