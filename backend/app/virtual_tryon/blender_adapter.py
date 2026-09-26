"""
Optional Blender Engine Adapter for Advanced Physics Simulation.

Provides an interface to Blender's native cloth simulator when Blender
is installed on the host system. Purely optional: if Blender is absent or
ENABLE_BLENDER_TRYON=false, the pipeline gracefully falls back to
deterministic 3D geometric draping without running any external process.
"""

from typing import Optional, Dict, Any
import subprocess
import tempfile
from pathlib import Path
from .config import get_blender_executable, is_blender_enabled


def is_blender_available() -> bool:
    """
    Checks if Blender physics simulator is explicitly enabled and discoverable.
    Returns False immediately when ENABLE_BLENDER_TRYON=false without invoking subprocess.
    """
    if not is_blender_enabled():
        return False

    be = get_blender_executable()
    if not be:
        return False
    try:
        res = subprocess.run([be, "--version"], capture_output=True, text=True, timeout=5)
        return res.returncode == 0
    except Exception:
        return False


def run_blender_cloth_simulation(
    avatar_obj_path: str,
    garment_obj_path: str,
    output_glb_path: str,
    simulation_steps: int = 15
) -> Optional[str]:
    """
    Runs Blender in background mode to simulate cloth draping onto avatar collision mesh.
    Returns path to exported GLB on success, or None on failure/unavailability.
    """
    if not is_blender_enabled() or not is_blender_available():
        return None

    be = get_blender_executable()
    if not be:
        return None

    # Generated controlled headless script to prevent shell injection
    script_content = f"""
import bpy
import sys

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import Avatar OBJ as Collision Obstacle
try:
    bpy.ops.wm.obj_import(filepath=r"{avatar_obj_path}")
    avatar = bpy.context.selected_objects[0]
    avatar.name = "AvatarCollision"
    bpy.ops.object.modifier_add(type='COLLISION')
except Exception as e:
    print(f"Error importing avatar: {{e}}")
    sys.exit(1)

# Import Garment OBJ as Cloth
try:
    bpy.ops.wm.obj_import(filepath=r"{garment_obj_path}")
    garment = bpy.context.selected_objects[0]
    garment.name = "GarmentCloth"
    cloth_mod = garment.modifiers.new(name="ClothModifier", type='CLOTH')
    cloth_mod.settings.quality = 4
    cloth_mod.collision_settings.collision_quality = 3
except Exception as e:
    print(f"Error importing garment: {{e}}")
    sys.exit(1)

# Step physics simulation
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = {simulation_steps}

for frame in range(1, {simulation_steps} + 1):
    scene.frame_set(frame)

# Export final settled mesh to GLB
try:
    bpy.ops.export_scene.gltf(
        filepath=r"{output_glb_path}",
        export_format='GLB',
        use_selection=False
    )
    print("BLENDER_EXPORT_SUCCESS")
except Exception as e:
    print(f"Export error: {{e}}")
    sys.exit(2)
"""

    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as script_file:
        script_file.write(script_content)
        script_path = script_file.name

    try:
        cmd = [be, "--background", "--python", script_path]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if proc.returncode == 0 and Path(output_glb_path).exists():
            return output_glb_path
        return None
    except Exception as e:
        print(f"[BlenderAdapter] Execution failed: {e}")
        return None
    finally:
        try:
            Path(script_path).unlink(missing_ok=True)
        except Exception:
            pass
