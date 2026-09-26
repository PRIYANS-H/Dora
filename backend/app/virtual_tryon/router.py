"""
FastAPI Router for DORI 3D Virtual Try-On Module.

Prefix: /virtual-tryon
Tags: ["3D Virtual Try-On"]

Optimized for CPU-first execution with bounded concurrency,
unblocked event loop, deterministic caching, and robust failure isolation.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse
from typing import Dict, Any

from .config import (
    is_3d_enabled,
    get_models_dir,
    get_smplx_model_path,
    get_threed_mode,
    get_threed_workers,
    get_threed_max_queue
)
from .schemas import (
    VirtualTryOnRequest,
    VirtualTryOnJobResponse,
    AvatarOnlyRequest,
    GarmentOnlyRequest,
    ModuleHealthResponse
)
from .service import tryon_service
from .blender_adapter import is_blender_available

router = APIRouter(prefix="/virtual-tryon", tags=["3D Virtual Try-On"])


def require_3d_enabled():
    """Dependency that ensures the feature flag is active before processing."""
    if not is_3d_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="3D Virtual Try-On feature is currently disabled. Set ENABLE_3D_TRYON=true in .env to enable."
        )


@router.get(
    "/health",
    response_model=ModuleHealthResponse,
    summary="Check 3D Virtual Try-On feature status",
    description="Reports the feature flag status, execution mode, directory health, and worker limits."
)
def get_tryon_health():
    """Reports the readiness and configuration status of the 3D module."""
    enabled = is_3d_enabled()
    models_dir = str(get_models_dir())
    blender_ok = is_blender_available()
    smplx_ok = get_smplx_model_path() is not None

    return ModuleHealthResponse(
        status="ready" if enabled else "disabled",
        enabled=enabled,
        mode=get_threed_mode(),
        blender_available=blender_ok,
        smplx_configured=smplx_ok,
        models_directory=models_dir,
        workers=get_threed_workers(),
        max_queue=get_threed_max_queue()
    )


@router.post(
    "/generate",
    response_model=VirtualTryOnJobResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate 3D Avatar & Garment GLB Model",
    description="Asynchronously generates a parametric 3D body avatar from user measurements, drapes garment geometry, and produces a valid .glb file.",
    dependencies=[Depends(require_3d_enabled)]
)
async def generate_virtual_tryon(payload: VirtualTryOnRequest):
    """Generates complete avatar + garment GLB model with worker slot management."""
    res = await tryon_service.execute_tryon_async(payload)
    if res.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"3D generation failed: {res.error}"
        )
    return res


@router.post(
    "",
    response_model=VirtualTryOnJobResponse,
    status_code=status.HTTP_200_OK,
    summary="Direct Alias for /virtual-tryon/generate",
    description="Convenience endpoint mounted at POST /virtual-tryon.",
    dependencies=[Depends(require_3d_enabled)]
)
async def generate_virtual_tryon_root(payload: VirtualTryOnRequest):
    """Direct root alias for 3D tryon generation."""
    return await generate_virtual_tryon(payload)


@router.get(
    "/{job_id}",
    response_model=VirtualTryOnJobResponse,
    summary="Get 3D Try-On Job Status",
    description="Retrieves the metadata, status, and model URL for a previously submitted 3D try-on job.",
    dependencies=[Depends(require_3d_enabled)]
)
def get_tryon_job(job_id: str):
    """Retrieve job details by job_id."""
    job = tryon_service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Try-on job '{job_id}' not found."
        )
    return VirtualTryOnJobResponse(**job)


@router.get(
    "/{job_id}/model",
    summary="Download or Stream GLB Model",
    description="Returns the raw binary .glb file for direct Three.js / WebGL rendering.",
    dependencies=[Depends(require_3d_enabled)]
)
def download_glb_model(job_id: str):
    """Streams the binary GLB 2.0 file to the client."""
    model_path = tryon_service.get_job_model_path(job_id)
    if not model_path or not model_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"3D model for job '{job_id}' not found or generation not completed."
        )
    return FileResponse(
        path=str(model_path),
        media_type="model/gltf-binary",
        filename=f"{job_id}.glb"
    )


@router.post(
    "/avatar",
    response_model=VirtualTryOnJobResponse,
    summary="Generate Standalone 3D Avatar (No Garment)",
    description="Produces a clean humanoid avatar GLB mesh matching the specified parameters.",
    dependencies=[Depends(require_3d_enabled)]
)
async def generate_avatar_only(payload: AvatarOnlyRequest):
    """Generate standalone avatar mesh with caching."""
    res = await tryon_service.execute_avatar_only_async(payload)
    if res.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Avatar generation failed: {res.error}"
        )
    return res


@router.post(
    "/garment",
    response_model=VirtualTryOnJobResponse,
    summary="Generate Standalone 3D Garment (No Avatar)",
    description="Produces a clean 3D garment GLB mesh from measurements without an avatar.",
    dependencies=[Depends(require_3d_enabled)]
)
async def generate_garment_only(payload: GarmentOnlyRequest):
    """Generate standalone garment mesh with caching."""
    res = await tryon_service.execute_garment_only_async(payload)
    if res.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Garment generation failed: {res.error}"
        )
    return res
