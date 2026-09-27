"""Virtual try-on and photo-to-3D.

Try-on runs IDM-VTON (github.com/yisol/IDM-VTON) through its Hugging Face Space;
3D uses Tripo's image-to-model API. Both take tens of seconds — longer than a
proxied request should hang — so each call starts a job the client polls.
"""
import io
import os
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from urllib.parse import urlparse

import cloudinary
import cloudinary.uploader
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.security import get_current_user

router = APIRouter()

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
TRYON_DIR = os.path.join(STATIC_DIR, "tryon")
MODELS_DIR = os.path.join(STATIC_DIR, "models")
os.makedirs(TRYON_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

# Images we are willing to fetch server-side: DORI uploads and the seeded catalog.
ALLOWED_IMAGE_HOSTS = {"res.cloudinary.com", "images.unsplash.com"}
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_MODEL_BYTES = 120 * 1024 * 1024
TRYON_TIMEOUT_SECONDS = 240

TRIPO_API = "https://api.tripo3d.ai/v2/openapi"
TRIPO_ERRORS = {
    1002: (503, "The Tripo API key was rejected. Check TRIPO_API_KEY in the backend .env."),
    2010: (402, "Your Tripo account is out of credits. Top up at platform.tripo3d.ai, then try again."),
    2003: (422, "Tripo couldn't read that image. Try a clear JPG or PNG."),
}

_pool = ThreadPoolExecutor(max_workers=3)
_lock = threading.Lock()
_tryon_jobs = {}
_model_tasks = {}


class TryOnRequest(BaseModel):
    person_image_url: str = Field(..., max_length=1000)
    garment_image_url: str = Field(..., max_length=1000)
    garment_description: str = Field("", max_length=300)


class ModelRequest(BaseModel):
    image_url: str = Field(..., max_length=1000)


def _resolve_image(url: str):
    """Returns a local path for our own /static files, or the URL for allowed hosts."""
    if url.startswith("/static/"):
        root = os.path.normpath(STATIC_DIR)
        path = os.path.normpath(os.path.join(root, url[len("/static/"):].split("?")[0]))
        if not path.startswith(root + os.sep) or not os.path.isfile(path):
            raise HTTPException(status_code=422, detail="That image isn't available any more.")
        return path
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_IMAGE_HOSTS:
        raise HTTPException(status_code=422, detail="Use a photo uploaded to DORI or a design from the DORI feed.")
    return url


def _image_bytes(source: str) -> bytes:
    if os.path.isfile(source):
        with open(source, "rb") as handle:
            data = handle.read()
    else:
        response = requests.get(source, timeout=30)
        response.raise_for_status()
        data = response.content
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Images must be 12 MB or smaller.")
    return data


def _image_type(data: bytes) -> str:
    if data.startswith(b"\x89PNG"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return "jpg"


def _cloud_ready() -> bool:
    config = cloudinary.config()
    return bool(config.cloud_name and config.api_secret)


def _persist(source, owner_id: str, kind: str, name: str, ext: str, resource_type: str = "image") -> str:
    """Stores a generated file durably (Cloudinary when configured, else /static)."""
    if _cloud_ready():
        try:
            payload = io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else source
            result = cloudinary.uploader.upload(payload, folder=f"dori/{owner_id}/{kind}", public_id=name, resource_type=resource_type, overwrite=True)
            return result["secure_url"]
        except Exception as error:
            print(f"[TryOn] Cloudinary upload failed, keeping {kind} locally: {error}")
    folder = TRYON_DIR if kind == "tryon" else MODELS_DIR
    target = os.path.join(folder, f"{name}.{ext}")
    if isinstance(source, (bytes, bytearray)):
        with open(target, "wb") as handle:
            handle.write(source)
    else:
        with open(source, "rb") as src, open(target, "wb") as dst:
            dst.write(src.read())
    return f"/static/{os.path.basename(folder)}/{name}.{ext}"


# ── Try-on (IDM-VTON on Hugging Face) ─────────────────────────────────────────

def _gradio_client(space: str):
    from gradio_client import Client
    token = os.getenv("HF_TOKEN") or None
    last_error = None
    for attempt in range(4):
        try:
            if not token:
                return Client(space, verbose=False)
            try:
                return Client(space, token=token, verbose=False)
            except TypeError:
                return Client(space, hf_token=token, verbose=False)
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            if "10054" not in err_str and "time" not in err_str and "connection" not in err_str and "retry" not in err_str:
                raise
            time.sleep(2)
    raise last_error


def _friendly_tryon_error(error: Exception) -> str:
    text = str(error)
    if "quota" in text.lower():
        return "The free Hugging Face GPU quota is used up for now. Add HF_TOKEN to the backend .env (or try again later)."
    if isinstance(error, TimeoutError) or "timeout" in text.lower():
        return "The try-on model took too long to respond. It may be busy — try again in a minute."
    if "RUNTIME_ERROR" in text or "PAUSED" in text or "sleeping" in text.lower():
        return "The try-on model is offline right now. Try again shortly."
    return f"The try-on model failed: {text}"


def _run_tryon(job_id: str, person: str, garment: str, description: str, owner_id: str):
    from gradio_client import handle_file
    space = os.getenv("TRYON_SPACE", "yisol/IDM-VTON")
    try:
        _update_job(job_id, stage="Connecting to the try-on model")
        client = _gradio_client(space)
        _update_job(job_id, stage="Fitting the garment to you")
        job = client.submit(
            dict={"background": handle_file(person), "layers": [], "composite": None},
            garm_img=handle_file(garment),
            garment_des=description or "garment",
            is_checked=True,
            is_checked_crop=False,
            denoise_steps=30,
            seed=42,
            api_name="/tryon",
        )
        output = job.result(timeout=TRYON_TIMEOUT_SECONDS)
        rendered = output[0] if isinstance(output, (list, tuple)) else output
        _update_job(job_id, stage="Saving your look")
        url = _persist(rendered, owner_id, "tryon", job_id, "png")
        _update_job(job_id, status="success", stage="Done", image_url=url, provider=space)
    except Exception as error:
        print(f"[TryOn] {space} failed for job {job_id}: {error}")
        _update_job(job_id, status="failed", stage="Failed", error=_friendly_tryon_error(error))


def _update_job(job_id: str, **changes):
    with _lock:
        _tryon_jobs[job_id].update(changes)


def _public_job(job: dict) -> dict:
    return {
        "job_id": job["job_id"], "status": job["status"], "stage": job.get("stage"),
        "image_url": job.get("image_url"), "provider": job.get("provider"), "error": job.get("error"),
        "elapsed_seconds": round(time.time() - job["started_at"]),
    }


@router.post("/tryon")
def start_tryon(payload: TryOnRequest, user=Depends(get_current_user)):
    try:
        import gradio_client  # noqa: F401
    except ImportError:
        raise HTTPException(status_code=503, detail="Try-on needs the gradio_client package. Rebuild the backend (pip install -r requirements.txt).")
    person = _resolve_image(payload.person_image_url.strip())
    garment = _resolve_image(payload.garment_image_url.strip())
    with _lock:
        if any(job["owner"] == user["id"] and job["status"] == "running" for job in _tryon_jobs.values()):
            raise HTTPException(status_code=429, detail="Your last try-on is still rendering — give it a moment.")
        job_id = uuid.uuid4().hex
        _tryon_jobs[job_id] = {"job_id": job_id, "owner": user["id"], "status": "running", "stage": "Queued", "started_at": time.time()}
    _pool.submit(_run_tryon, job_id, person, garment, payload.garment_description.strip(), user["id"])
    return _public_job(_tryon_jobs[job_id])


@router.get("/tryon/{job_id}")
def get_tryon(job_id: str, user=Depends(get_current_user)):
    job = _tryon_jobs.get(job_id)
    if not job or job["owner"] != user["id"]:
        raise HTTPException(status_code=404, detail="Try-on not found. It may have expired — start a new one.")
    return _public_job(job)


# ── Photo → 3D (Tripo image-to-model) ─────────────────────────────────────────

def _update_model_job(task_id: str, **changes):
    with _lock:
        if task_id in _model_tasks:
            _model_tasks[task_id].update(changes)


def _public_model_job(job: dict) -> dict:
    return {
        "task_id": job["task_id"], "status": job["status"], "stage": job.get("stage"),
        "progress": job.get("progress", 0), "model_url": job.get("model_url"),
        "preview_url": job.get("preview_url"), "error": job.get("error"),
    }


def _run_model3d(task_id: str, image_bytes: bytes, owner_id: str):
    from gradio_client import handle_file
    
    def _predict_with_retry(client, *args, **kwargs):
        last_error = None
        for attempt in range(5):
            try:
                return client.predict(*args, **kwargs)
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "10054" not in err_str and "time" not in err_str and "connection" not in err_str and "retry" not in err_str:
                    raise
                print(f"[Model3D] Network error on attempt {attempt+1} ({e}), retrying...")
                time.sleep(3)
        raise last_error

    try:
        _update_model_job(task_id, stage="Initializing 3D engine", progress=10)
        # Save bytes to temp file
        temp_img = os.path.join(tempfile.gettempdir(), f"{task_id}.png")
        with open(temp_img, "wb") as f:
            f.write(image_bytes)

        client = _gradio_client("TencentARC/InstantMesh")
        
        _update_model_job(task_id, stage="Removing background", progress=30)
        processed_img = _predict_with_retry(client,
            handle_file(temp_img),
            True, # Remove background
            api_name="/preprocess"
        )
        
        _update_model_job(task_id, stage="Generating multi-views", progress=60)
        mvs_result = _predict_with_retry(client,
            handle_file(processed_img),
            75, # Sample Steps
            42, # Seed
            api_name="/generate_mvs"
        )
        state = mvs_result[0] if isinstance(mvs_result, (list, tuple)) else mvs_result
        mvs = mvs_result[1] if isinstance(mvs_result, (list, tuple)) and len(mvs_result) > 1 else None
        
        _update_model_job(task_id, stage="Building 3D Mesh (This takes a moment)", progress=85)
        model_result = _predict_with_retry(client,
            state,
            api_name="/make3d"
        )
        obj_path = model_result[0] if isinstance(model_result, (list, tuple)) else model_result
        glb_path = model_result[1] if isinstance(model_result, (list, tuple)) and len(model_result) > 1 else obj_path
        
        _update_model_job(task_id, stage="Saving 3D model", progress=95)
        with open(glb_path, "rb") as f:
            glb_data = f.read()
        url = _persist(glb_data, owner_id, "models", task_id, "glb", resource_type="raw")
        
        try:
            with open(mvs, "rb") as f:
                preview_data = f.read()
            preview_url = _persist(preview_data, owner_id, "tryon", f"{task_id}-preview", "webp")
        except Exception:
            preview_url = None
        
        _update_model_job(task_id, status="success", stage="Done", progress=100, model_url=url, preview_url=preview_url)
        
        # Cleanup
        for path in (temp_img, processed_img, mvs, obj_path, glb_path):
            try:
                if path and os.path.exists(path): os.remove(path)
            except Exception: pass
            
    except Exception as error:
        print(f"[Model3D] InstantMesh failed for task {task_id}: {error}")
        _update_model_job(task_id, status="failed", stage="Failed", progress=100, error=str(error))


@router.get("/models3d/status")
def model_status(user=Depends(get_current_user)):
    # Always available now that it's free
    return {"available": True, "balance": 999, "reason": None}


@router.post("/models3d")
def start_model(payload: ModelRequest, user=Depends(get_current_user)):
    try:
        import gradio_client  # noqa: F401
    except ImportError:
        raise HTTPException(status_code=503, detail="3D Generation needs the gradio_client package.")
    
    image = _image_bytes(_resolve_image(payload.image_url.strip()))
    
    with _lock:
        if any(job.get("owner") == user["id"] and job["status"] == "running" for job in _model_tasks.values()):
            raise HTTPException(status_code=429, detail="Your last 3D model is still generating, please wait.")
        task_id = uuid.uuid4().hex
        _model_tasks[task_id] = {"task_id": task_id, "owner": user["id"], "status": "running", "stage": "Queued", "progress": 0}
        
    _pool.submit(_run_model3d, task_id, image, user["id"])
    return _public_model_job(_model_tasks[task_id])


@router.get("/models3d/{task_id}")
def get_model(task_id: str, user=Depends(get_current_user)):
    job = _model_tasks.get(task_id)
    if not job or job.get("owner") != user["id"]:
        raise HTTPException(status_code=404, detail="3D model not found.")
    return _public_model_job(job)
