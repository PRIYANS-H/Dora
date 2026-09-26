import os
from dotenv import load_dotenv

# Load environment variables from .env file (override system env)
load_dotenv(override=True)

from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.database import get_db, init_db
from app.models import Post, Remix, Tailor, Order
from app import schemas
from app.services.matcher import compute_tailor_match
from app.services.remix_engine import generate_remixed_image
from app.seed import seed_database

# Import Modular Routers
from app.routers import media, ai_caption, posts, engagement
from app.virtual_tryon import router as virtual_tryon_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = next(get_db())
    if db.query(Post).count() == 0:
        seed_database()
    yield

app = FastAPI(
    title="DORI Fashion Remix & Tailoring Engine API",
    version="1.1.0",
    description="Backend API powering DORI: Designer Social Feed, Media Uploads, AI Captions, Engagement, Remix Studio, and Tailor Matching.",
    lifespan=lifespan
)

# Enable CORS for local dev and production builds
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static upload directories exist and mount static files
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
UPLOADS_MEDIA_DIR = os.path.join(STATIC_DIR, "uploads", "media")
MODELS_3D_DIR = os.path.join(STATIC_DIR, "3d_models")
os.makedirs(UPLOADS_MEDIA_DIR, exist_ok=True)
os.makedirs(MODELS_3D_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Mount Social Feed & Media Routers
app.include_router(posts.router)
app.include_router(media.router)
app.include_router(ai_caption.router)
app.include_router(engagement.router)
app.include_router(virtual_tryon_router)

# ==========================================
# Core DORI System Endpoints
# ==========================================

@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "app": "DORI API", "tagline": "See it. Remix it. Wear it."}

# Remix Endpoints
@app.get("/remixes", response_model=List[schemas.RemixResponse], tags=["Remix Studio"])
def get_remixes(db: Session = Depends(get_db)):
    return db.query(Remix).all()

@app.post("/remix", response_model=schemas.RemixResponse, tags=["Remix Studio"])
def create_remix(payload: schemas.RemixCreate, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == payload.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Base post not found")

    remixed_image_url = generate_remixed_image(
        post_id=post.id,
        base_image_url=post.image_url,
        base_attributes=post.base_attributes,
        new_attributes=payload.attributes
    )

    remix = Remix(
        post_id=post.id,
        user_label="Demo User",
        attributes=payload.attributes,
        remixed_image_url=remixed_image_url
    )
    db.add(remix)
    db.commit()
    db.refresh(remix)
    return remix

# Tailor Match Endpoints
@app.post("/tailors/match", response_model=List[schemas.TailorMatchResponse], tags=["Tailor Matching"])
@app.get("/tailors/match", response_model=List[schemas.TailorMatchResponse], tags=["Tailor Matching"])
def match_tailors(
    payload: Optional[schemas.TailorMatchRequest] = Body(None),
    attributes_json: Optional[str] = Query(None),
    lat: float = Query(37.7749),
    lng: float = Query(-122.4194),
    db: Session = Depends(get_db)
):
    import json
    requested_attributes = {}
    if payload and payload.attributes:
        requested_attributes = payload.attributes
        lat = payload.lat or lat
        lng = payload.lng or lng
    elif attributes_json:
        try:
            requested_attributes = json.loads(attributes_json)
        except Exception:
            pass

    tailors = db.query(Tailor).all()
    results = []
    for t in tailors:
        match_data = compute_tailor_match(t, requested_attributes, user_lat=lat, user_lng=lng)
        res = schemas.TailorMatchResponse(
            id=t.id,
            name=t.name,
            photo_url=t.photo_url,
            skills=t.skills or [],
            lat=t.lat,
            lng=t.lng,
            rating=t.rating,
            reviews_count=t.reviews_count,
            price_band=t.price_band,
            portfolio_tags=t.portfolio_tags or [],
            match_score=match_data["match_score"],
            breakdown=schemas.SubScoreBreakdown(**match_data["breakdown"])
        )
        results.append(res)

    results.sort(key=lambda x: x.match_score, reverse=True)
    return results[:3]

# Order Endpoints
@app.post("/orders", response_model=schemas.OrderResponse, tags=["Orders"])
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    remix = db.query(Remix).filter(Remix.id == payload.remix_id).first()
    if not remix:
        raise HTTPException(status_code=404, detail="Remix not found")

    tailor = db.query(Tailor).filter(Tailor.id == payload.tailor_id).first()
    if not tailor:
        raise HTTPException(status_code=404, detail="Tailor not found")

    match_data = compute_tailor_match(tailor, remix.attributes)

    order = Order(
        remix_id=remix.id,
        tailor_id=tailor.id,
        match_score=match_data["match_score"],
        measurements=payload.measurements,
        status="placed"
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    post = db.query(Post).filter(Post.id == remix.post_id).first()
    return schemas.OrderResponse(
        id=order.id,
        remix_id=order.remix_id,
        tailor_id=order.tailor_id,
        match_score=order.match_score,
        measurements=order.measurements,
        status=order.status,
        created_at=order.created_at,
        remix={"id": remix.id, "attributes": remix.attributes, "remixed_image_url": remix.remixed_image_url},
        tailor={"id": tailor.id, "name": tailor.name, "photo_url": tailor.photo_url, "price_band": tailor.price_band},
        post={"id": post.id, "title": post.title, "designer_name": post.designer_name, "price_reference": post.price_reference} if post else None
    )

@app.get("/orders", response_model=List[schemas.OrderResponse], tags=["Orders"])
def get_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    results = []
    for order in orders:
        remix = db.query(Remix).filter(Remix.id == order.remix_id).first()
        tailor = db.query(Tailor).filter(Tailor.id == order.tailor_id).first()
        post = db.query(Post).filter(Post.id == remix.post_id).first() if remix else None
        results.append(schemas.OrderResponse(
            id=order.id,
            remix_id=order.remix_id,
            tailor_id=order.tailor_id,
            match_score=order.match_score,
            measurements=order.measurements,
            status=order.status,
            created_at=order.created_at,
            remix={"id": remix.id, "attributes": remix.attributes, "remixed_image_url": remix.remixed_image_url} if remix else None,
            tailor={"id": tailor.id, "name": tailor.name, "photo_url": tailor.photo_url, "price_band": tailor.price_band} if tailor else None,
            post={"id": post.id, "title": post.title, "designer_name": post.designer_name, "price_reference": post.price_reference} if post else None
        ))
    return results

@app.get("/orders/{id}", response_model=schemas.OrderResponse, tags=["Orders"])
def get_order(id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    remix = db.query(Remix).filter(Remix.id == order.remix_id).first()
    tailor = db.query(Tailor).filter(Tailor.id == order.tailor_id).first()
    post = db.query(Post).filter(Post.id == remix.post_id).first() if remix else None

    return schemas.OrderResponse(
        id=order.id,
        remix_id=order.remix_id,
        tailor_id=order.tailor_id,
        match_score=order.match_score,
        measurements=order.measurements,
        status=order.status,
        created_at=order.created_at,
        remix={"id": remix.id, "attributes": remix.attributes, "remixed_image_url": remix.remixed_image_url} if remix else None,
        tailor={"id": tailor.id, "name": tailor.name, "photo_url": tailor.photo_url, "price_band": tailor.price_band} if tailor else None,
        post={"id": post.id, "title": post.title, "designer_name": post.designer_name, "price_reference": post.price_reference} if post else None
    )

@app.patch("/orders/{id}/status", response_model=schemas.OrderResponse, tags=["Orders"])
def update_order_status(id: str, payload: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    valid_statuses = ["placed", "accepted", "stitching", "ready", "delivered"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    order.status = payload.status
    db.commit()
    db.refresh(order)
    return get_order(id, db)

@app.get("/orders/{id}/receipt", response_model=schemas.RoyaltyReceiptResponse, tags=["Orders"])
def get_order_receipt(id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    remix = db.query(Remix).filter(Remix.id == order.remix_id).first()
    post = db.query(Post).filter(Post.id == remix.post_id).first() if remix else None
    base_price = post.price_reference if post else 300

    return schemas.RoyaltyReceiptResponse(
        order_id=order.id,
        price_reference=base_price,
        designer_amount=round(base_price * 0.15, 2),
        tailor_amount=round(base_price * 0.70, 2),
        platform_amount=round(base_price * 0.15, 2),
        designer_share_pct=15,
        tailor_share_pct=70,
        platform_share_pct=15
    )
