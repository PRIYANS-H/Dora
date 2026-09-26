"""
Benchmark Script for DORI CPU-Optimized 3D Virtual Try-On.

Measures:
1. Cold generation time (cache miss)
2. Warm cache-hit time (instant reuse)
3. Avatar reuse time (same avatar, different garment)
4. Garment reuse time
5. Memory usage and GLB file size
6. Vertex and triangle counts
"""

import os
import sys
import time
import tracemalloc
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.virtual_tryon.config import (
    is_3d_enabled,
    get_threed_mode,
    get_threed_workers,
    get_threed_max_queue,
    get_models_dir
)
from app.virtual_tryon.schemas import VirtualTryOnRequest, GarmentMeasurements
from app.virtual_tryon.service import tryon_service
from app.virtual_tryon.glb_service import validate_glb_file


def run_benchmark():
    print("=" * 65)
    print("   DORI 3D Virtual Try-On CPU Benchmark (i3-1215U / 8GB RAM)")
    print("=" * 65)
    print(f"3D Enabled:        {is_3d_enabled()}")
    print(f"3D Mode:           {get_threed_mode()}")
    print(f"Workers:           {get_threed_workers()}")
    print(f"Max Queue:         {get_threed_max_queue()}")
    print(f"Models Directory:  {get_models_dir()}")
    print("-" * 65)

    tracemalloc.start()

    # 1. Cold Generation (First Generation - Cache Miss)
    req1 = VirtualTryOnRequest(
        height_cm=175.0,
        weight_kg=70.0,
        gender="neutral",
        pose="A-pose",
        garment_type="tee",
        garment_color="#18181b",
        garment_measurements=GarmentMeasurements(chest=96.0, waist=82.0, hip=98.0, length=68.0, sleeve=22.0)
    )

    t0 = time.perf_counter()
    mem_before = tracemalloc.get_traced_memory()[0]
    res1 = tryon_service.execute_tryon(req1)
    t_cold = (time.perf_counter() - t0) * 1000
    mem_after = tracemalloc.get_traced_memory()[0]
    cold_mem_kb = (mem_after - mem_before) / 1024

    assert res1.status == "completed", f"Cold generation failed: {res1.error}"
    glb1_path = tryon_service.get_job_model_path(res1.job_id)
    val1 = validate_glb_file(glb1_path)

    av_meta1 = res1.metadata.get("avatar", {})
    g_meta1 = res1.metadata.get("garment", {})
    total_verts = av_meta1.get("vertex_count", 0) + g_meta1.get("vertex_count", 0)
    total_tris = av_meta1.get("face_count", 0) + g_meta1.get("face_count", 0)

    print("\n[1] COLD GENERATION (First Request - Cache Miss):")
    print(f"    Status:              {res1.status}")
    print(f"    Generation Time:     {t_cold:.2f} ms ({t_cold / 1000:.3f} s)")
    print(f"    Memory Delta:        {cold_mem_kb:.2f} KB")
    print(f"    GLB File Size:       {val1['file_size']:,} bytes ({val1['file_size'] / 1024:.2f} KB)")
    print(f"    Avatar Triangles:    {av_meta1.get('face_count', 0):,}")
    print(f"    Garment Triangles:   {g_meta1.get('face_count', 0):,}")
    print(f"    Combined Triangles:  {total_tris:,} (Target <= 20,000)")
    print(f"    Combined Vertices:   {total_verts:,}")

    # 2. Warm Request (Identical Parameters - Full Tryon Cache Hit)
    t0 = time.perf_counter()
    res2 = tryon_service.execute_tryon(req1)
    t_warm = (time.perf_counter() - t0) * 1000

    assert res2.status == "completed"
    assert res2.metadata.get("cache_hit") is True

    print("\n[2] WARM REQUEST (Identical Parameters - Full Cache Hit):")
    print(f"    Status:              {res2.status}")
    print(f"    Cache Hit Flag:      {res2.metadata.get('cache_hit')}")
    print(f"    Response Time:       {t_warm:.2f} ms ({t_warm / 1000:.4f} s)")
    print(f"    Speedup Factor:      {t_cold / max(0.001, t_warm):.1f}x faster")

    # 3. Avatar Reuse (Different Garment, Same Avatar Parameters)
    req3 = VirtualTryOnRequest(
        height_cm=175.0,
        weight_kg=70.0,
        gender="neutral",
        pose="A-pose",
        garment_type="dress",
        garment_color="#ec4899",
        garment_measurements=GarmentMeasurements(chest=94.0, waist=76.0, hip=102.0, length=95.0, sleeve=0.0)
    )

    t0 = time.perf_counter()
    res3 = tryon_service.execute_tryon(req3)
    t_av_reuse = (time.perf_counter() - t0) * 1000

    assert res3.status == "completed"
    assert res3.metadata.get("avatar_cache_hit") is True

    print("\n[3] AVATAR REUSE (Changed Garment to Dress, Same Avatar):")
    print(f"    Status:              {res3.status}")
    print(f"    Avatar Cache Hit:    {res3.metadata.get('avatar_cache_hit')}")
    print(f"    Generation Time:     {t_av_reuse:.2f} ms ({t_av_reuse / 1000:.3f} s)")

    # 4. Garment Reuse (Same Dress Garment, Slight Height Change)
    req4 = VirtualTryOnRequest(
        height_cm=178.0,
        weight_kg=72.0,
        gender="neutral",
        pose="A-pose",
        garment_type="dress",
        garment_color="#ec4899",
        garment_measurements=GarmentMeasurements(chest=94.0, waist=76.0, hip=102.0, length=95.0, sleeve=0.0)
    )

    t0 = time.perf_counter()
    res4 = tryon_service.execute_tryon(req4)
    t_g_reuse = (time.perf_counter() - t0) * 1000

    print("\n[4] SECOND GARMENT RUN:")
    print(f"    Status:              {res4.status}")
    print(f"    Generation Time:     {t_g_reuse:.2f} ms")

    # Peak memory
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    print("\n" + "=" * 65)
    print("   BENCHMARK SUMMARY")
    print("=" * 65)
    print(f"Cold Generation:        {t_cold:.1f} ms  (Target < 5,000 ms)")
    print(f"Cached Generation:      {t_warm:.1f} ms  (Target < 100 ms)")
    print(f"Avatar Triangle Count:  {av_meta1.get('face_count', 0):,}  (Target <= 15,000)")
    print(f"Garment Triangle Count: {g_meta1.get('face_count', 0):,}  (Target <= 5,000)")
    print(f"Typical GLB Size:       {val1['file_size'] / 1024:.1f} KB  (Target < 1,000 KB)")
    print(f"Peak Traced RAM:        {peak_mem / (1024 * 1024):.2f} MB")
    print("=" * 65)


if __name__ == "__main__":
    run_benchmark()
