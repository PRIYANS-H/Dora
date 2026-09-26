"""
DORI 3D Virtual Try-On Module.

An isolated backend module for parametric 3D avatar generation,
garment geometry generation, and GLB export.
"""

from .config import is_3d_enabled, get_models_dir
from .router import router

__all__ = ["router", "is_3d_enabled", "get_models_dir"]
