"""
Configuration and Resource Management for DORI 3D Virtual Try-On.

Optimized for CPU-first execution on Intel Core i3 / 8 GB RAM systems.
Controls thread pinning, lazy dependencies, bounded queues, and disk caching.
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional

# Pin CPU thread counts early to avoid thread explosion across P/E cores
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")


def is_3d_enabled() -> bool:
    """Check if the 3D Virtual Try-On experimental feature flag is active."""
    val = os.getenv("ENABLE_3D_TRYON", "true").strip().lower()
    return val in ("true", "1", "yes", "on", "enabled")


def get_threed_mode() -> str:
    """
    Returns 3D execution mode: 'basic' (default CPU parametric) or 'advanced'.
    Basic mode is strictly enforced as the default.
    """
    mode = os.getenv("THREED_MODE", "basic").strip().lower()
    return "advanced" if mode == "advanced" else "basic"


def is_blender_enabled() -> bool:
    """Check if Blender physics simulator is explicitly enabled."""
    val = os.getenv("ENABLE_BLENDER_TRYON", "false").strip().lower()
    return val in ("true", "1", "yes", "on")


def is_pifuhd_enabled() -> bool:
    """Check if PIFuHD is enabled (strictly false by default)."""
    val = os.getenv("ENABLE_PIFUHD", "false").strip().lower()
    return val in ("true", "1", "yes", "on")


def is_photo_to_smplx_enabled() -> bool:
    """Check if photo-to-SMPLX is enabled (strictly false by default)."""
    val = os.getenv("ENABLE_PHOTO_TO_SMPLX", "false").strip().lower()
    return val in ("true", "1", "yes", "on")


def get_threed_workers() -> int:
    """Get max concurrent 3D workers (strictly 1 for i3-1215U development)."""
    try:
        val = int(os.getenv("THREED_WORKERS", "1"))
        return max(1, val)
    except ValueError:
        return 1


def get_threed_max_queue() -> int:
    """Get max queue depth for pending 3D jobs before returning busy (5 default)."""
    try:
        val = int(os.getenv("THREED_MAX_QUEUE", "5"))
        return max(1, val)
    except ValueError:
        return 5


def get_threed_cache_max_mb() -> int:
    """Max disk cache allowance in Megabytes (500 MB default)."""
    try:
        val = int(os.getenv("THREED_CACHE_MAX_MB", "500"))
        return max(50, val)
    except ValueError:
        return 500


def get_backend_dir() -> Path:
    """Return absolute path to backend root directory."""
    return Path(__file__).resolve().parent.parent.parent


def get_models_dir() -> Path:
    """Return path to backend/static/3d_models and ensure it exists."""
    models_dir = get_backend_dir() / "static" / "3d_models"
    models_dir.mkdir(parents=True, exist_ok=True)
    return models_dir


def get_cache_dir() -> Path:
    """Return root cache directory for reusable 3D assets."""
    cache_dir = get_models_dir() / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_avatar_cache_dir() -> Path:
    """Cache folder specifically for reusable base humanoid avatars."""
    d = get_cache_dir() / "avatars"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_garment_cache_dir() -> Path:
    """Cache folder specifically for reusable standalone garments."""
    d = get_cache_dir() / "garments"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_tryon_cache_dir() -> Path:
    """Cache folder for assembled avatar + garment tryon scenes."""
    d = get_cache_dir() / "tryons"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_model_url(job_id_or_rel_path: str) -> str:
    """Return client URL for a generated or cached GLB model."""
    clean = job_id_or_rel_path.replace("\\", "/").lstrip("/")
    if clean.startswith("static/3d_models/"):
        return f"/{clean}"
    if clean.endswith(".glb"):
        return f"/static/3d_models/{clean}"
    return f"/static/3d_models/{clean}.glb"


def get_smplx_model_path() -> Optional[str]:
    """Return path to optional SMPL-X model weights if configured."""
    if not is_photo_to_smplx_enabled():
        return None
    path = os.getenv("SMPLX_MODEL_PATH")
    if path and Path(path).exists():
        return path
    return None


def get_blender_executable() -> Optional[str]:
    """Return path to optional Blender executable if enabled."""
    if not is_blender_enabled():
        return None
    import shutil
    be = os.getenv("BLENDER_EXECUTABLE") or os.getenv("BLENDER_PATH")
    if be and Path(be).exists():
        return be
    return shutil.which("blender")


def prune_cache_if_needed(max_mb: Optional[int] = None) -> int:
    """
    Deletes the oldest cached .glb files when total cache size exceeds max_mb.
    Never deletes files outside static/3d_models/cache.
    Returns number of deleted files.
    """
    limit_mb = max_mb or get_threed_cache_max_mb()
    limit_bytes = limit_mb * 1024 * 1024
    cache_root = get_cache_dir()

    if not cache_root.exists():
        return 0

    glb_files = []
    total_size = 0

    for f in cache_root.rglob("*.glb"):
        try:
            st = f.stat()
            glb_files.append((st.st_mtime, st.st_size, f))
            total_size += st.st_size
        except OSError:
            continue

    if total_size <= limit_bytes:
        return 0

    # Sort oldest first (smallest mtime)
    glb_files.sort(key=lambda x: x[0])
    deleted_count = 0

    for mtime, size, fpath in glb_files:
        try:
            fpath.unlink(missing_ok=True)
            total_size -= size
            deleted_count += 1
            if total_size <= int(limit_bytes * 0.85):  # Prune to 85% of limit
                break
        except OSError:
            continue

    return deleted_count
