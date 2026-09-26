"""
Core Orchestration Service for DORI 3D Virtual Try-On.

Optimized for CPU-first execution on Intel Core i3 / 8 GB RAM machines.
Integrates deterministic caching for avatars, garments, and tryon scenes,
ensuring zero duplicate generation, low memory overhead, and unblocked event loops.
"""

from typing import Dict, Any, Optional, Tuple
import uuid
import gc
import shutil
import asyncio
from datetime import datetime, timezone
from pathlib import Path
import threading

from .config import (
    get_models_dir,
    get_model_url,
    is_3d_enabled,
    get_threed_mode,
    prune_cache_if_needed
)
from .cache import cache_manager
from .concurrency import concurrency_manager
from .schemas import (
    VirtualTryOnRequest,
    VirtualTryOnJobResponse,
    AvatarOnlyRequest,
    GarmentOnlyRequest
)
from .avatar_service import generate_avatar_mesh
from .garment_service import generate_garment_mesh
from .glb_service import export_tryon_scene_to_glb, validate_glb_file, GLBBuilder
from .blender_adapter import is_blender_available


class VirtualTryOnService:
    """Thread-safe job orchestrator with deterministic caching and CPU optimization."""

    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve job record by ID."""
        with self._lock:
            return self._jobs.get(job_id)

    def get_job_model_path(self, job_id: str) -> Optional[Path]:
        """Retrieve path to GLB model if job is completed."""
        with self._lock:
            job = self._jobs.get(job_id)
        if not job or job.get("status") != "completed":
            return None
        model_path = job.get("model_path")
        if model_path and Path(model_path).exists():
            return Path(model_path)
        return None

    # =========================================================================
    # Synchronous Core Execution Methods
    # =========================================================================
    def execute_tryon(self, req: VirtualTryOnRequest) -> VirtualTryOnJobResponse:
        """
        Executes end-to-end 3D Virtual Try-On generation with deterministic caching:
        Check tryon cache -> Check avatar cache -> Check garment cache -> Assemble GLB.
        """
        job_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        models_dir = get_models_dir()
        glb_path = models_dir / f"{job_id}.glb"
        model_url = get_model_url(job_id)

        job_data: Dict[str, Any] = {
            "job_id": job_id,
            "status": "processing",
            "model_url": model_url,
            "model_path": str(glb_path),
            "created_at": created_at,
            "metadata": {},
            "error": None
        }
        with self._lock:
            self._jobs[job_id] = job_data

        try:
            # 1. Deterministic Cache Keys
            avatar_key = cache_manager.hash_avatar(
                height_cm=req.height_cm,
                weight_kg=req.weight_kg,
                gender=req.gender,
                pose=req.pose
            )
            garment_meas = req.garment_measurements.model_dump() if req.garment_measurements else None
            garment_key = cache_manager.hash_garment(
                garment_type=req.garment_type,
                garment_color=req.garment_color,
                measurements=garment_meas,
                avatar_height_cm=req.height_cm,
                avatar_pose=req.pose
            )
            tryon_key = cache_manager.hash_tryon(avatar_key, garment_key)

            cached_tryon_file = cache_manager.get_tryon_disk_path(tryon_key)

            # -----------------------------------------------------------------
            # FAST PATH: Complete tryon scene already cached on disk!
            # -----------------------------------------------------------------
            if cache_manager.has_cached_tryon(tryon_key):
                # Copy or serve cached file directly
                shutil.copyfile(cached_tryon_file, glb_path)
                val = validate_glb_file(glb_path)

                metadata = {
                    "cache_hit": True,
                    "avatar_cache_hit": True,
                    "garment_cache_hit": True,
                    "cache_type": "full_tryon",
                    "avatar_key": avatar_key,
                    "garment_key": garment_key,
                    "tryon_key": tryon_key,
                    "mode": get_threed_mode(),
                    "user_parameters": {
                        "height_cm": req.height_cm,
                        "weight_kg": req.weight_kg,
                        "gender": req.gender,
                        "pose": req.pose
                    },
                    "garment": {
                        "garment_type": req.garment_type,
                        "garment_color": req.garment_color,
                        "type": req.garment_type,
                        "color": req.garment_color
                    },
                    "avatar": {
                        "gender": req.gender,
                        "pose": req.pose,
                        "generator": "parametric_humanoid_engine_v1"
                    },
                    "glb_info": {
                        "file_size_bytes": val["file_size"],
                        "mesh_count": val["mesh_count"],
                        "node_count": val["node_count"],
                        "format": "glTF 2.0 Binary"
                    },
                    "blender_simulated": False,
                    "blender_available": is_blender_available()
                }

                with self._lock:
                    job_data["status"] = "completed"
                    job_data["metadata"] = metadata

                return VirtualTryOnJobResponse(
                    job_id=job_id,
                    status="completed",
                    model_url=model_url,
                    created_at=created_at,
                    metadata=metadata
                )

            # -----------------------------------------------------------------
            # SLOW PATH: Generate or reuse avatar & garment meshes
            # -----------------------------------------------------------------
            # 2. Reusable Avatar Geometry (In-Memory LRU Cache)
            cached_avatar = cache_manager.get_cached_avatar_mesh(avatar_key)
            if cached_avatar is not None:
                av_verts, av_faces, av_norms, av_uvs, av_meta = cached_avatar
                avatar_cache_hit = True
            else:
                av_verts, av_faces, av_norms, av_uvs, av_meta = generate_avatar_mesh(
                    height_cm=req.height_cm,
                    weight_kg=req.weight_kg,
                    gender=req.gender,
                    pose=req.pose
                )
                cache_manager.store_avatar_mesh(avatar_key, (av_verts, av_faces, av_norms, av_uvs, av_meta))
                avatar_cache_hit = False

            avatar_data = (av_verts, av_faces, av_norms, av_uvs)

            # 3. Reusable Garment Geometry (In-Memory LRU Cache)
            cached_garment = cache_manager.get_cached_garment_mesh(garment_key)
            if cached_garment is not None:
                g_verts, g_faces, g_norms, g_uvs, g_color, g_meta = cached_garment
                garment_cache_hit = True
            else:
                g_verts, g_faces, g_norms, g_uvs, g_color, g_meta = generate_garment_mesh(
                    garment_type=req.garment_type,
                    garment_color=req.garment_color,
                    measurements=garment_meas,
                    avatar_height_cm=req.height_cm,
                    avatar_pose=req.pose
                )
                cache_manager.store_garment_mesh(garment_key, (g_verts, g_faces, g_norms, g_uvs, g_color, g_meta))
                garment_cache_hit = False

            garment_data = (g_verts, g_faces, g_norms, g_uvs, g_color)

            # 4. Export to binary GLB container and persist to tryon disk cache
            export_tryon_scene_to_glb(avatar_data, garment_data, output_path=cached_tryon_file)
            shutil.copyfile(cached_tryon_file, glb_path)

            # 5. Validate output file
            val = validate_glb_file(glb_path)
            if not val.get("valid"):
                raise RuntimeError(f"GLB validation failed: {val.get('error')}")

            # 6. Check cache quota
            prune_cache_if_needed()

            # 7. Metadata
            metadata = {
                "cache_hit": False,
                "avatar_cache_hit": avatar_cache_hit,
                "garment_cache_hit": garment_cache_hit,
                "avatar_key": avatar_key,
                "garment_key": garment_key,
                "tryon_key": tryon_key,
                "mode": get_threed_mode(),
                "user_parameters": {
                    "height_cm": req.height_cm,
                    "weight_kg": req.weight_kg,
                    "gender": req.gender,
                    "pose": req.pose
                },
                "garment": g_meta,
                "avatar": av_meta,
                "glb_info": {
                    "file_size_bytes": val["file_size"],
                    "mesh_count": val["mesh_count"],
                    "node_count": val["node_count"],
                    "format": "glTF 2.0 Binary"
                },
                "blender_simulated": False,
                "blender_available": is_blender_available()
            }

            with self._lock:
                job_data["status"] = "completed"
                job_data["metadata"] = metadata

            # Immediate memory cleanup for low-spec CPU/RAM
            del avatar_data
            del garment_data
            gc.collect()

            return VirtualTryOnJobResponse(
                job_id=job_id,
                status="completed",
                model_url=model_url,
                created_at=created_at,
                metadata=metadata
            )

        except Exception as e:
            error_str = str(e)
            with self._lock:
                job_data["status"] = "failed"
                job_data["error"] = error_str

            return VirtualTryOnJobResponse(
                job_id=job_id,
                status="failed",
                created_at=created_at,
                error=error_str
            )

    def execute_avatar_only(self, req: AvatarOnlyRequest) -> VirtualTryOnJobResponse:
        """Generates standalone 3D avatar with disk and memory caching."""
        job_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        models_dir = get_models_dir()
        glb_path = models_dir / f"{job_id}.glb"
        model_url = get_model_url(job_id)

        try:
            avatar_key = cache_manager.hash_avatar(
                height_cm=req.height_cm,
                weight_kg=req.weight_kg,
                gender=req.gender,
                pose=req.pose
            )
            cached_disk_path = cache_manager.get_avatar_disk_path(avatar_key)

            if cache_manager.has_cached_avatar_glb(avatar_key):
                shutil.copyfile(cached_disk_path, glb_path)
                val = validate_glb_file(glb_path)
                metadata = {"cache_hit": True, "avatar_key": avatar_key, "glb_info": val}
            else:
                cached_mesh = cache_manager.get_cached_avatar_mesh(avatar_key)
                if cached_mesh is not None:
                    av_verts, av_faces, av_norms, av_uvs, av_meta = cached_mesh
                else:
                    av_verts, av_faces, av_norms, av_uvs, av_meta = generate_avatar_mesh(
                        height_cm=req.height_cm,
                        weight_kg=req.weight_kg,
                        gender=req.gender,
                        pose=req.pose
                    )
                    cache_manager.store_avatar_mesh(avatar_key, (av_verts, av_faces, av_norms, av_uvs, av_meta))

                export_tryon_scene_to_glb((av_verts, av_faces, av_norms, av_uvs), garment_data=None, output_path=cached_disk_path)
                shutil.copyfile(cached_disk_path, glb_path)
                val = validate_glb_file(glb_path)
                metadata = {"cache_hit": False, "avatar_key": avatar_key, "avatar": av_meta, "glb_info": val}

            job_data = {
                "job_id": job_id,
                "status": "completed",
                "model_url": model_url,
                "model_path": str(glb_path),
                "created_at": created_at,
                "metadata": metadata,
                "error": None
            }
            with self._lock:
                self._jobs[job_id] = job_data

            gc.collect()
            return VirtualTryOnJobResponse(
                job_id=job_id,
                status="completed",
                model_url=model_url,
                created_at=created_at,
                metadata=metadata
            )
        except Exception as e:
            return VirtualTryOnJobResponse(
                job_id=job_id,
                status="failed",
                created_at=created_at,
                error=str(e)
            )

    def execute_garment_only(self, req: GarmentOnlyRequest) -> VirtualTryOnJobResponse:
        """Generates standalone 3D garment with disk and memory caching."""
        job_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        models_dir = get_models_dir()
        glb_path = models_dir / f"{job_id}.glb"
        model_url = get_model_url(job_id)

        try:
            meas = req.garment_measurements.model_dump() if req.garment_measurements else None
            garment_key = cache_manager.hash_garment(
                garment_type=req.garment_type,
                garment_color=req.garment_color,
                measurements=meas,
                avatar_height_cm=175.0,
                avatar_pose="A-pose"
            )
            cached_disk_path = cache_manager.get_garment_disk_path(garment_key)

            if cache_manager.has_cached_garment_glb(garment_key):
                shutil.copyfile(cached_disk_path, glb_path)
                val = validate_glb_file(glb_path)
                metadata = {"cache_hit": True, "garment_key": garment_key, "glb_info": val}
            else:
                cached_mesh = cache_manager.get_cached_garment_mesh(garment_key)
                if cached_mesh is not None:
                    g_verts, g_faces, g_norms, g_uvs, g_color, g_meta = cached_mesh
                else:
                    g_verts, g_faces, g_norms, g_uvs, g_color, g_meta = generate_garment_mesh(
                        garment_type=req.garment_type,
                        garment_color=req.garment_color,
                        measurements=meas
                    )
                    cache_manager.store_garment_mesh(garment_key, (g_verts, g_faces, g_norms, g_uvs, g_color, g_meta))

                builder = GLBBuilder()
                mat_idx = builder.add_material("GarmentOnlyMaterial", g_color, roughness=0.85, metallic=0.05)
                builder.add_mesh_primitive("GarmentMesh", g_verts, g_faces, g_norms, g_uvs, mat_idx)
                glb_bytes = builder.build_glb()
                cached_disk_path.write_bytes(glb_bytes)
                shutil.copyfile(cached_disk_path, glb_path)

                val = validate_glb_file(glb_path)
                metadata = {"cache_hit": False, "garment_key": garment_key, "garment": g_meta, "glb_info": val}

            job_data = {
                "job_id": job_id,
                "status": "completed",
                "model_url": model_url,
                "model_path": str(glb_path),
                "created_at": created_at,
                "metadata": metadata,
                "error": None
            }
            with self._lock:
                self._jobs[job_id] = job_data

            gc.collect()
            return VirtualTryOnJobResponse(
                job_id=job_id,
                status="completed",
                model_url=model_url,
                created_at=created_at,
                metadata=metadata
            )
        except Exception as e:
            return VirtualTryOnJobResponse(
                job_id=job_id,
                status="failed",
                created_at=created_at,
                error=str(e)
            )

    # =========================================================================
    # Async Methods with Concurrency & Queue Protection
    # =========================================================================
    async def execute_tryon_async(self, req: VirtualTryOnRequest) -> VirtualTryOnJobResponse:
        """Asynchronously executes tryon inside worker slot, keeping event loop unblocked."""
        async with concurrency_manager.acquire_worker_slot():
            return await asyncio.to_thread(self.execute_tryon, req)

    async def execute_avatar_only_async(self, req: AvatarOnlyRequest) -> VirtualTryOnJobResponse:
        """Asynchronously executes avatar inside worker slot."""
        async with concurrency_manager.acquire_worker_slot():
            return await asyncio.to_thread(self.execute_avatar_only, req)

    async def execute_garment_only_async(self, req: GarmentOnlyRequest) -> VirtualTryOnJobResponse:
        """Asynchronously executes garment inside worker slot."""
        async with concurrency_manager.acquire_worker_slot():
            return await asyncio.to_thread(self.execute_garment_only, req)


# Global Service Instance
tryon_service = VirtualTryOnService()
