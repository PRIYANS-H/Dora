"""
Deterministic 3D Caching Service for DORI 3D Virtual Try-On.

Ensures that identical avatar, garment, or tryon parameter sets are generated
exactly once and reused indefinitely. Supports disk persistence and lightweight
in-memory LRU mesh caching for fast garment swaps on low-spec CPUs.
"""

from typing import Dict, Any, Tuple, Optional, List
import hashlib
import json
from pathlib import Path
from collections import OrderedDict
import threading
import numpy as np

from .config import (
    get_avatar_cache_dir,
    get_garment_cache_dir,
    get_tryon_cache_dir,
    get_model_url
)


class ThreeDCacheManager:
    """Thread-safe disk and in-memory cache manager for 3D assets."""

    def __init__(self, max_memory_entries: int = 8):
        self._max_mem = max_memory_entries
        self._avatar_mesh_cache: OrderedDict[str, Any] = OrderedDict()
        self._garment_mesh_cache: OrderedDict[str, Any] = OrderedDict()
        self._lock = threading.Lock()

    # -------------------------------------------------------------
    # Hashing Functions
    # -------------------------------------------------------------
    @staticmethod
    def hash_avatar(height_cm: float, weight_kg: float, gender: str, pose: str, version: str = "v1") -> str:
        """Deterministic hash key for humanoid body parameters."""
        raw = f"{version}:{float(height_cm):.1f}:{float(weight_kg):.1f}:{gender.lower().strip()}:{pose.lower().strip()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    @staticmethod
    def hash_garment(
        garment_type: str,
        garment_color: str,
        measurements: Optional[Dict[str, float]],
        avatar_height_cm: float,
        avatar_pose: str,
        version: str = "v1"
    ) -> str:
        """Deterministic hash key for garment parameters."""
        meas_str = json.dumps(measurements or {}, sort_keys=True)
        raw = f"{version}:{garment_type.lower()}:{garment_color.lower()}:{meas_str}:{float(avatar_height_cm):.1f}:{avatar_pose.lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    @staticmethod
    def hash_tryon(avatar_key: str, garment_key: str, version: str = "v1") -> str:
        """Deterministic hash key for assembled tryon scene."""
        raw = f"{version}:{avatar_key}:{garment_key}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    # -------------------------------------------------------------
    # Disk Path Resolvers
    # -------------------------------------------------------------
    def get_avatar_disk_path(self, avatar_key: str) -> Path:
        return get_avatar_cache_dir() / f"avatar_{avatar_key}.glb"

    def get_garment_disk_path(self, garment_key: str) -> Path:
        return get_garment_cache_dir() / f"garment_{garment_key}.glb"

    def get_tryon_disk_path(self, tryon_key: str) -> Path:
        return get_tryon_cache_dir() / f"tryon_{tryon_key}.glb"

    # -------------------------------------------------------------
    # Disk Cache Checks
    # -------------------------------------------------------------
    def has_cached_tryon(self, tryon_key: str) -> bool:
        p = self.get_tryon_disk_path(tryon_key)
        return p.exists() and p.stat().st_size > 100

    def has_cached_avatar_glb(self, avatar_key: str) -> bool:
        p = self.get_avatar_disk_path(avatar_key)
        return p.exists() and p.stat().st_size > 100

    def has_cached_garment_glb(self, garment_key: str) -> bool:
        p = self.get_garment_disk_path(garment_key)
        return p.exists() and p.stat().st_size > 100

    # -------------------------------------------------------------
    # In-Memory Mesh LRU Cache
    # -------------------------------------------------------------
    def get_cached_avatar_mesh(self, avatar_key: str) -> Optional[Tuple]:
        with self._lock:
            if avatar_key in self._avatar_mesh_cache:
                self._avatar_mesh_cache.move_to_end(avatar_key)
                return self._avatar_mesh_cache[avatar_key]
        return None

    def store_avatar_mesh(self, avatar_key: str, mesh_data: Tuple):
        with self._lock:
            if avatar_key in self._avatar_mesh_cache:
                self._avatar_mesh_cache.move_to_end(avatar_key)
            else:
                if len(self._avatar_mesh_cache) >= self._max_mem:
                    self._avatar_mesh_cache.popitem(last=False)
                self._avatar_mesh_cache[avatar_key] = mesh_data

    def get_cached_garment_mesh(self, garment_key: str) -> Optional[Tuple]:
        with self._lock:
            if garment_key in self._garment_mesh_cache:
                self._garment_mesh_cache.move_to_end(garment_key)
                return self._garment_mesh_cache[garment_key]
        return None

    def store_garment_mesh(self, garment_key: str, mesh_data: Tuple):
        with self._lock:
            if garment_key in self._garment_mesh_cache:
                self._garment_mesh_cache.move_to_end(garment_key)
            else:
                if len(self._garment_mesh_cache) >= self._max_mem:
                    self._garment_mesh_cache.popitem(last=False)
                self._garment_mesh_cache[garment_key] = mesh_data


# Singleton Cache Manager
cache_manager = ThreeDCacheManager()
