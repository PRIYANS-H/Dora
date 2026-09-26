"""Virtual try-on and photo-to-3D.

Try-on runs IDM-VTON (github.com/yisol/IDM-VTON) through its Hugging Face Space;
3D uses Tripo's image-to-model API. Both take tens of seconds — longer than a
proxied request should hang — so each call starts a job the client polls.
"""
import io
import os
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
    if not token:
        return Client(space, verbose=False)
    try:
        return Client(space, token=token, verbose=False)
    except TypeError:  # gradio_client < 2 named it hf_token
        return Client(space, hf_token=token, verbose=False)


def _friendly_tryon_error(error: Exception) -> str:
    text = str(error)
    if "quota" in text.lower():
        return "The free Hugging Face GPU quota is used up for now. Add HF_TOKEN to the backend .env (or try again later)."
    if isinstance(error, TimeoutError) or "timeout" in text.lower():
        return "The try-on model took too long to respond. It may be busy — try again in a minute."
    if "RUNTIME_ERROR" in text or "PAUSED" in text or "sleeping" in text.lower():
        return "The try-on model is offline right now. Try again shortly."
    return "The try-on model couldn't process these photos. Try a clearer, front-facing photo."


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

def _tripo(method: str, path: str, **kwargs) -> dict:
    key = os.getenv("TRIPO_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="3D generation isn't configured. Add TRIPO_API_KEY to the backend .env.")
    try:
        response = requests.request(method, f"{TRIPO_API}{path}", headers={"Authorization": f"Bearer {key}"}, timeout=kwargs.pop("timeout", 60), **kwargs)
        body = response.json()
    except (requests.RequestException, ValueError):
        raise HTTPException(status_code=502, detail="Couldn't reach Tripo. Try again in a moment.")
    code = body.get("code")
    if code != 0:
        status, message = TRIPO_ERRORS.get(code, (502, body.get("message") or "Tripo couldn't start this model."))
        raise HTTPException(status_code=status, detail=message)
    return body.get("data") or {}


def _output_url(output: dict, *keys) -> Optional[str]:
    for key in keys:
        value = output.get(key)
        if isinstance(value, dict):
            value = value.get("url")
        if value:
            return value
    return None


def _store_model(task_id: str, data: dict):
    """Tripo's output links expire within minutes, so keep our own copy on success."""
    record = _model_tasks.setdefault(task_id, {"owner": None})
    with record.setdefault("lock", threading.Lock()):
        if record.get("model_url"):
            return
        output = data.get("output") or {}
        remote_model = _output_url(output, "pbr_model", "model", "base_model", "model_url")
        if not remote_model:
            raise HTTPException(status_code=502, detail="Tripo finished but returned no model file.")
        response = requests.get(remote_model, timeout=120)
        response.raise_for_status()
        if len(response.content) > MAX_MODEL_BYTES:
            raise HTTPException(status_code=502, detail="The generated model is too large to store.")
        owner = record.get("owner") or "shared"
        record["model_url"] = _persist(response.content, owner, "models", task_id, "glb", resource_type="raw")
        preview = _output_url(output, "rendered_image", "rendered_image_url")
        if preview:
            try:
                image = requests.get(preview, timeout=60)
                image.raise_for_status()
                record["preview_url"] = _persist(image.content, owner, "tryon", f"{task_id}-preview", "webp")
            except requests.RequestException:
                pass


@router.get("/models3d/status")
def model_status(user=Depends(get_current_user)):
    try:
        data = _tripo("GET", "/user/balance", timeout=20)
    except HTTPException as error:
        return {"available": False, "reason": error.detail}
    balance = data.get("balance") or 0
    return {"available": balance > 0, "balance": balance, "reason": None if balance > 0 else TRIPO_ERRORS[2010][1]}


@router.post("/models3d")
def start_model(payload: ModelRequest, user=Depends(get_current_user)):
    image = _image_bytes(_resolve_image(payload.image_url.strip()))
    kind = _image_type(image)
    token = _tripo("POST", "/upload", files={"file": (f"photo.{kind}", image, f"image/{'jpeg' if kind == 'jpg' else kind}")}).get("image_token")
    if not token:
        raise HTTPException(status_code=502, detail="Tripo didn't accept the photo upload.")
    task = _tripo("POST", "/task", json={
        "type": "image_to_model",
        "file": {"type": kind, "file_token": token},
        "model_version": os.getenv("TRIPO_MODEL_VERSION", "v2.5-20250123"),
        "texture": True,
        "pbr": True,
    })
    task_id = task.get("task_id")
    if not task_id:
        raise HTTPException(status_code=502, detail="Tripo didn't return a task.")
    _model_tasks[task_id] = {"owner": user["id"], "lock": threading.Lock()}
    return {"task_id": task_id, "status": "queued", "progress": 0}


@router.get("/models3d/{task_id}")
def get_model(task_id: str, user=Depends(get_current_user)):
    record = _model_tasks.get(task_id)
    if record and record.get("owner") not in (None, user["id"]):
        raise HTTPException(status_code=404, detail="3D model not found.")
    if record and record.get("model_url"):
        return {"task_id": task_id, "status": "success", "progress": 100, "model_url": record["model_url"], "preview_url": record.get("preview_url")}
    data = _tripo("GET", f"/task/{task_id}", timeout=30)
    status = data.get("status", "unknown")
    if status == "success":
        _store_model(task_id, data)
        record = _model_tasks[task_id]
        return {"task_id": task_id, "status": "success", "progress": 100, "model_url": record["model_url"], "preview_url": record.get("preview_url")}
    failed = status in {"failed", "cancelled", "banned", "expired", "unknown"}
    return {
        "task_id": task_id, "status": status, "progress": data.get("progress") or 0,
        "error": "Tripo couldn't build a model from this photo. Try a clearer photo with a plain background." if failed else None,
    }
