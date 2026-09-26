import os
import uuid
import base64
from datetime import datetime
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Body, UploadFile, File
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

# Static files for remixed images and uploaded media
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
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
        try:
            sb.storage.create_bucket("posts", options={"public": True})
            print("[DORI] Created Supabase posts bucket.")
        except Exception as storage_error:
            if "already exists" not in str(storage_error).lower() and "duplicate" not in str(storage_error).lower():
                print(f"[DORI] Posts bucket setup skipped: {storage_error}")
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


# ── 1. GET /posts & POST /posts ────────────────────────────────────────────────

@app.get("/posts", response_model=List[schemas.PostResponse])
def get_posts():
    sb = get_supabase()
    result = sb.table("posts").select("*").order("created_at", desc=True).execute()
    return result.data or []


@app.post("/posts", response_model=schemas.PostResponse)
def create_post(payload: schemas.PostBase):
    sb = get_supabase()
    post_id = f"post-{uuid.uuid4().hex[:8]}"
    post_row = {
        "id": post_id,
        "title": payload.title,
        "image_url": payload.image_url,
        "designer_name": payload.designer_name,
        "designer_handle": payload.designer_handle,
        "base_attributes": payload.base_attributes,
        "price_reference": payload.price_reference,
        "created_at": datetime.utcnow().isoformat(),
    }
    insert_res = sb.table("posts").insert(post_row).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to create post")
    return insert_res.data[0]


# ── POST /upload ──────────────────────────────────────────────────────────────

@app.post("/upload")
@app.post("/posts/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file and return its public or static URL."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    contents = await file.read()
    ext = os.path.splitext(file.filename or "")[1].lower()
    if not ext or ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        ext = ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    content_type = file.content_type or "image/jpeg"

    # 1. Try uploading to Supabase Storage if configured
    try:
        sb = get_supabase()
        for bucket in ["posts", "avatars"]:
            try:
                storage_path = f"uploads/{filename}" if bucket == "avatars" else filename
                sb.storage.from_(bucket).upload(
                    path=storage_path,
                    file=contents,
                    file_options={"content-type": content_type}
                )
                public_url = sb.storage.from_(bucket).get_public_url(storage_path)
                return {"url": public_url, "image_url": public_url}
            except Exception:
                continue
    except Exception:
        pass

    # 2. Local static storage fallback (served at /static/uploads/...)
    local_path = os.path.join(UPLOAD_DIR, filename)
    with open(local_path, "wb") as f:
        f.write(contents)

    url = f"/static/uploads/{filename}"
    return {"url": url, "image_url": url}


# ── AI Caption Generation with Gemini Vision ────────────────────────────────────

@app.get("/ai/status")
def get_ai_status():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path, override=True)
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return {
        "configured": bool(key),
        "key_prefix": (key[:6] + "...") if len(key) > 6 else ("configured" if key else ""),
    }


@app.post("/ai/generate-caption", response_model=schemas.CaptionResponse)
@app.post("/posts/generate-caption", response_model=schemas.CaptionResponse)
def generate_ai_caption(payload: schemas.CaptionRequest):
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path, override=True)
    
    gemini_key = (payload.api_key or "").strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API key is required. Please set GEMINI_API_KEY in backend/.env or enter it in the AI Caption settings.",
        )

    image_bytes = None
    mime_type = "image/jpeg"

    if payload.image_data:
        try:
            if "," in payload.image_data:
                header, encoded = payload.image_data.split(",", 1)
                if ":" in header and ";" in header:
                    mime_type = header.split(":")[1].split(";")[0]
            else:
                encoded = payload.image_data
            image_bytes = base64.b64decode(encoded)
        except Exception as e:
            print(f"[GeminiCaption] Base64 decode error: {e}")

    elif payload.image_url:
        try:
            if payload.image_url.startswith("/static/"):
                rel_path = payload.image_url.replace("/static/", "", 1)
                disk_path = os.path.join(STATIC_DIR, rel_path)
                if os.path.exists(disk_path):
                    with open(disk_path, "rb") as f:
                        image_bytes = f.read()
                    if disk_path.lower().endswith(".png"):
                        mime_type = "image/png"
                    elif disk_path.lower().endswith(".webp"):
                        mime_type = "image/webp"
            elif payload.image_url.startswith("http"):
                import requests
                resp = requests.get(payload.image_url, timeout=10)
                if resp.status_code == 200:
                    image_bytes = resp.content
                    ct = resp.headers.get("Content-Type", "")
                    if ct:
                        mime_type = ct.split(";")[0]
        except Exception as e:
            print(f"[GeminiCaption] Failed to fetch image_url: {e}")

    tone_descriptors = {
        "Creative": "Evocative, poetic, avant-garde and artistic haute couture narrative",
        "Luxury": "Atelier couture elegance, bespoke tailoring, opulent luxury, and sophisticated refinement",
        "Streetwear": "Edgy, bold, urban contemporary, culture-defining aesthetic, and unapologetic grit",
        "Minimal": "Understated, crisp, architectural lines, purity of form, and refined restraint",
        "Editorial": "Structured, dramatic, high-fashion runway critique, and visionary magazine styling",
        "Casual": "Effortless everyday, approachable chic, breezy elegance, and versatile wardrobe notes",
    }
    tone_name = payload.tone or "Creative"
    tone_desc = tone_descriptors.get(tone_name, "High-fashion couture aesthetic")

    prompt = (
        f"You are an elite fashion designer and couture editor for DORI Fashion House.\n"
        f"Analyze this garment / piece (Design Title: '{payload.title or 'Atelier Silhouette'}') "
        f"and craft a captivating, authentic social fashion post caption in a {tone_name} aesthetic ({tone_desc}).\n\n"
        f"Style Guidelines:\n"
        f"- Describe the silhouette, fabric drapery, tailoring details, texture, and mood.\n"
        f"- Keep it evocative, concise (around 50 to 90 words), and engaging for fashion enthusiasts.\n"
        f"- Conclude with 3 to 4 curated high-fashion hashtags (e.g. #DORICouture #{tone_name}Fashion #AtelierDesign).\n"
        f"- Return ONLY the raw caption text without introductory notes or surrounding markdown code blocks."
    )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_key)
        contents = []
        if image_bytes:
            contents.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))
        contents.append(prompt)

        model_name = "gemini-2.5-flash"
        try:
            res = client.models.generate_content(
                model=model_name,
                contents=contents,
            )
            caption_text = res.text.strip()
        except Exception as primary_err:
            print(f"[GeminiCaption] gemini-2.5-flash error, falling back to gemini-1.5-flash: {primary_err}")
            model_name = "gemini-1.5-flash"
            res = client.models.generate_content(
                model=model_name,
                contents=contents,
            )
            caption_text = res.text.strip()

        return schemas.CaptionResponse(
            caption=caption_text,
            tone=tone_name,
            model_used=model_name
        )
    except Exception as e:
        error_msg = str(e)
        print(f"[GeminiCaption] Error calling Gemini: {error_msg}")
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {error_msg}"
        )



# ── 3D Preview — TRELLIS via Hugging Face ZeroGPU ──────────────────────────────

@app.get("/3d/status")
def threed_status():
    """Check if the TRELLIS space is reachable."""
    try:
        from gradio_client import Client
        load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"), override=True)
        hf_token = os.getenv("HF_TOKEN") or None
        client = Client("trellis-community/TRELLIS", token=hf_token, httpx_kwargs={"timeout": 60.0})
        return {"status": "reachable", "space": "trellis-community/TRELLIS", "hf_token_set": bool(hf_token)}
    except Exception as e:
        return {"status": "unreachable", "error": str(e), "space": "trellis-community/TRELLIS"}


@app.post("/3d/generate", response_model=schemas.ThreeDResponse)
async def generate_3d(payload: schemas.ThreeDRequest):
    """
    Generate a 3D GLB model from an image using Microsoft TRELLIS (ZeroGPU).
    Falls back to a demo .glb on quota errors.
    """
    import tempfile, shutil, urllib.request
    from pathlib import Path

    load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"), override=True)

    # Resolve HF token (payload > env)
    hf_token = payload.hf_token or os.getenv("HF_TOKEN") or None

    MODELS_DIR = os.path.join(STATIC_DIR, "models")
    os.makedirs(MODELS_DIR, exist_ok=True)
    latest_dress = os.path.join(MODELS_DIR, "latest_garment.glb")
    DEMO_GLB_URL = "/static/models/latest_garment.glb" if os.path.exists(latest_dress) else "/static/models/couture_garment_demo.glb"

    # ── Download / decode the input image into a temp file ────────────────────
    tmp_dir = tempfile.mkdtemp()
    img_path = os.path.join(tmp_dir, "input.png")

    try:
        if payload.image_data:
            # base64 data URI or raw base64
            raw = payload.image_data
            if "," in raw:
                raw = raw.split(",", 1)[1]
            with open(img_path, "wb") as f:
                f.write(base64.b64decode(raw))
        elif payload.image_url:
            url = payload.image_url
            # Handle relative /static/ URLs → read directly from disk
            if url.startswith("/static/"):
                rel_path = url[len("/static/"):].lstrip("/\\")
                disk_file = os.path.join(STATIC_DIR, rel_path)
                if os.path.exists(disk_file):
                    shutil.copy2(disk_file, img_path)
                else:
                    url = f"http://127.0.0.1:8000{url}"
            if not os.path.exists(img_path) or os.path.getsize(img_path) == 0:
                headers = {"User-Agent": "Mozilla/5.0"}
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=30) as resp, open(img_path, "wb") as f:
                    f.write(resp.read())
        else:
            raise HTTPException(status_code=400, detail="Provide image_url or image_data")

        try:
            from gradio_client import Client, handle_file
        except ImportError:
            raise HTTPException(status_code=500, detail="gradio_client not installed. Run: pip install gradio_client")

        # ── ENGINE 1: Tencent Hunyuan3D 2.0 (High-Speed & Ultra-Dense Mesh) ──
        if payload.engine == "hunyuan3d":
            print(f"[Hunyuan3D-2] Connecting to space (token={'set' if hf_token else 'none'})…")
            h_client = Client("tencent/Hunyuan3D-2", token=hf_token, httpx_kwargs={"timeout": 180.0})
            print("[Hunyuan3D-2] Generating 3D mesh via /shape_generation…")
            h_res = h_client.predict(
                caption=None,
                image=handle_file(img_path),
                mv_image_front=None,
                mv_image_back=None,
                mv_image_left=None,
                mv_image_right=None,
                steps=20,
                guidance_scale=5.0,
                seed=1234,
                octree_resolution=256,
                check_box_rembg=True,
                num_chunks=8000,
                randomize_seed=True,
                api_name="/shape_generation"
            )
            print(f"[Hunyuan3D-2] Result: {h_res}")
            glb_source = None
            if isinstance(h_res, (list, tuple)) and len(h_res) > 0:
                first = h_res[0]
                if isinstance(first, dict):
                    glb_source = first.get("value")
                elif isinstance(first, str):
                    glb_source = first

            if glb_source and os.path.exists(glb_source):
                model_id = str(uuid.uuid4())
                dest_path = os.path.join(MODELS_DIR, f"{model_id}.glb")
                shutil.copy2(glb_source, dest_path)
                return schemas.ThreeDResponse(
                    glb_url=f"/static/models/{model_id}.glb",
                    engine="hunyuan3d",
                    status="ready",
                    message="3D model generated via Tencent Hunyuan3D 2.0 (High-Density Geometry)"
                )

        # ── ENGINE 2: Microsoft TRELLIS (Default — SLaT Full Texture PBR) ────
        print(f"[TRELLIS] Connecting to space (token={'set' if hf_token else 'none'})…")
        client = Client("trellis-community/TRELLIS", token=hf_token, httpx_kwargs={"timeout": 300.0})

        # Step 1: Start session
        print("[TRELLIS] Starting session…")
        client.predict(api_name="/start_session")
        print("[TRELLIS] Session started")

        # Step 2: Preprocess image (background removal)
        print("[TRELLIS] Preprocessing image (background removal)…")
        preprocess_result = client.predict(
            image=handle_file(img_path),
            api_name="/preprocess_image"
        )
        print(f"[TRELLIS] Preprocessed result: {preprocess_result}")

        if isinstance(preprocess_result, dict):
            p = preprocess_result.get("path") or preprocess_result.get("url") or str(preprocess_result)
            preprocessed_image_arg = handle_file(p)
        else:
            preprocessed_image_arg = handle_file(str(preprocess_result))

        # Step 3: Generate 3D model
        print("[TRELLIS] Generating 3D GLB (this takes 30-60s)…")
        gen_result = client.predict(
            image=preprocessed_image_arg,
            multiimages=[],
            seed=0,
            ss_guidance_strength=7.5,
            ss_sampling_steps=12,
            slat_guidance_strength=3.0,
            slat_sampling_steps=12,
            multiimage_algo="stochastic",
            mesh_simplify=0.95,
            texture_size=1024,
            api_name="/generate_and_extract_glb"
        )
        print(f"[TRELLIS] Raw generation result: {gen_result}")

        # Extract GLB filepath: result = (video_dict, glb_path, download_glb_path)
        glb_source = None
        if isinstance(gen_result, (list, tuple)):
            for idx in [2, 1, 0]:
                if idx >= len(gen_result):
                    continue
                candidate = gen_result[idx]
                if isinstance(candidate, str) and candidate.endswith(".glb") and os.path.exists(candidate):
                    glb_source = candidate
                    break
                elif isinstance(candidate, dict):
                    p = candidate.get("path") or candidate.get("url", "")
                    if p and str(p).endswith(".glb") and os.path.exists(str(p)):
                        glb_source = str(p)
                        break
        elif isinstance(gen_result, str) and gen_result.endswith(".glb") and os.path.exists(gen_result):
            glb_source = gen_result

        print(f"[TRELLIS] GLB source resolved: {glb_source}")

        if not glb_source:
            print(f"[TRELLIS] No valid GLB found in: {gen_result}")
            return schemas.ThreeDResponse(
                glb_url=DEMO_GLB_URL,
                engine="trellis",
                status="demo",
                message="TRELLIS returned no GLB file. Showing demo model."
            )

        # Save to static/models/
        model_id = str(uuid.uuid4())
        dest_path = os.path.join(MODELS_DIR, f"{model_id}.glb")
        shutil.copy2(glb_source, dest_path)
        glb_url = f"/static/models/{model_id}.glb"
        print(f"[TRELLIS] Saved GLB -> {dest_path}")

        return schemas.ThreeDResponse(
            glb_url=glb_url,
            engine="trellis",
            status="ready",
            message="3D model generated successfully via Microsoft TRELLIS"
        )

    except Exception as e:
        error_str = str(e)
        print(f"[TRELLIS] Error: {error_str}")

        # Quota exceeded → graceful fallback
        quota_keywords = ["quota", "zerogpu", "exceeded", "try again", "authenticate"]
        if any(kw in error_str.lower() for kw in quota_keywords):
            return schemas.ThreeDResponse(
                glb_url=DEMO_GLB_URL,
                engine="trellis",
                status="quota_exceeded",
                message=f"ZeroGPU quota exceeded. Showing demo model. Add HF_TOKEN to .env for more quota. ({error_str[:200]})"
            )

        return schemas.ThreeDResponse(
            glb_url=DEMO_GLB_URL,
            engine="trellis",
            status="error",
            message=f"TRELLIS error: {error_str[:300]}. Showing demo model."
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


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
