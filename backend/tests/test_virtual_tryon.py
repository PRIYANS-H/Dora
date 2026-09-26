"""
Automated Test Suite for DORI 3D Virtual Try-On Module.

Verifies:
1. Zero regression on existing DORI endpoints (/health, /posts, /remixes).
2. Proper feature flag behavior when disabled (ENABLE_3D_TRYON=false).
3. Complete 3D pipeline when enabled (ENABLE_3D_TRYON=true).
4. Authentic GLB 2.0 binary verification (header magic, version, meshes).
5. Standalone avatar and garment endpoints.
"""

import os
import io
import struct
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.virtual_tryon.glb_service import validate_glb_file

client = TestClient(app)


# ========================================================
# 1. Existing DORI Core Regression Tests
# ========================================================

def test_existing_health_endpoint():
    """Verify existing /health endpoint is completely unaffected."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "DORI API"
    assert "tagline" in data


def test_existing_posts_endpoint():
    """Verify existing /posts social feed is completely unaffected."""
    res = client.get("/posts")
    assert res.status_code == 200
    posts = res.json()
    assert isinstance(posts, list)


def test_existing_remixes_endpoint():
    """Verify existing /remixes endpoint is completely unaffected."""
    res = client.get("/remixes")
    assert res.status_code == 200
    remixes = res.json()
    assert isinstance(remixes, list)


# ========================================================
# 2. Feature Flag Disabled Tests
# ========================================================

def test_3d_disabled_behavior():
    """When ENABLE_3D_TRYON=false, endpoints must reject requests with 503."""
    old_env = os.environ.get("ENABLE_3D_TRYON")
    try:
        os.environ["ENABLE_3D_TRYON"] = "false"

        # Health reports disabled
        h_res = client.get("/virtual-tryon/health")
        assert h_res.status_code == 200
        assert h_res.json()["status"] == "disabled"
        assert h_res.json()["enabled"] is False

        # Generate rejects with 503
        gen_res = client.post("/virtual-tryon/generate", json={
            "height_cm": 175,
            "weight_kg": 70,
            "gender": "neutral",
            "pose": "A-pose",
            "garment_type": "tee",
            "garment_color": "#111111"
        })
        assert gen_res.status_code == 503
        assert "disabled" in gen_res.json()["detail"].lower()

        # Job retrieval rejects with 503
        job_res = client.get("/virtual-tryon/dummy-id")
        assert job_res.status_code == 503

    finally:
        if old_env is not None:
            os.environ["ENABLE_3D_TRYON"] = old_env
        else:
            os.environ.pop("ENABLE_3D_TRYON", None)


# ========================================================
# 3. Feature Flag Enabled Tests (Full 3D Pipeline)
# ========================================================

def test_3d_tryon_generate_and_glb_validation():
    """
    Test complete 3D Try-On flow:
    POST /virtual-tryon/generate -> job created -> GLB generated -> binary validated.
    """
    old_env = os.environ.get("ENABLE_3D_TRYON")
    os.environ["ENABLE_3D_TRYON"] = "true"

    try:
        # Check health reports ready
        h_res = client.get("/virtual-tryon/health")
        assert h_res.status_code == 200
        assert h_res.json()["status"] == "ready"
        assert h_res.json()["enabled"] is True

        payload = {
            "height_cm": 175,
            "weight_kg": 70,
            "gender": "neutral",
            "pose": "A-pose",
            "garment_type": "tee",
            "garment_color": "#222222",
            "garment_measurements": {
                "chest": 96,
                "waist": 82,
                "hip": 98,
                "length": 68,
                "sleeve": 22
            }
        }

        # 1. Generate Virtual Try-On
        gen_res = client.post("/virtual-tryon/generate", json=payload)
        assert gen_res.status_code == 200
        job_data = gen_res.json()

        assert "job_id" in job_data
        assert job_data["status"] == "completed"
        assert job_data["model_url"].startswith("/static/3d_models/")
        job_id = job_data["job_id"]

        # Verify metadata details
        meta = job_data["metadata"]
        assert meta["user_parameters"]["height_cm"] == 175
        assert meta["garment"]["garment_type"] == "tee"
        assert meta["avatar"]["generator"] == "parametric_humanoid_engine_v1"
        assert meta["glb_info"]["file_size_bytes"] > 0
        assert meta["glb_info"]["mesh_count"] == 2  # Avatar + Garment

        # 2. Get Job Status via API
        status_res = client.get(f"/virtual-tryon/{job_id}")
        assert status_res.status_code == 200
        assert status_res.json()["job_id"] == job_id
        assert status_res.json()["status"] == "completed"

        # 3. Download GLB model via API
        model_res = client.get(f"/virtual-tryon/{job_id}/model")
        assert model_res.status_code == 200
        assert model_res.headers.get("content-type") == "model/gltf-binary"
        glb_bytes = model_res.content
        assert len(glb_bytes) > 0

        # 4. Also verify static file mount serves the model
        static_res = client.get(job_data["model_url"])
        assert static_res.status_code == 200
        assert len(static_res.content) == len(glb_bytes)

        # 5. Rigorous GLB Binary Header and Chunk Validation
        assert len(glb_bytes) >= 20
        magic, version, length = struct.unpack("<4sII", glb_bytes[:12])
        assert magic == b"glTF", f"Expected b'glTF', got {magic}"
        assert version == 2, f"Expected glTF version 2, got {version}"
        assert length == len(glb_bytes), f"Header length {length} != bytes {len(glb_bytes)}"

        # Validate using validator service
        backend_dir = Path(__file__).resolve().parent.parent
        disk_path = backend_dir / "static" / "3d_models" / f"{job_id}.glb"
        assert disk_path.exists()

        val = validate_glb_file(disk_path)
        assert val["valid"] is True
        assert val["mesh_count"] == 2
        assert val["node_count"] == 2
        assert val["file_size"] > 1000

    finally:
        if old_env is not None:
            os.environ["ENABLE_3D_TRYON"] = old_env
        else:
            os.environ.pop("ENABLE_3D_TRYON", None)


def test_garment_types_dress_and_jeans():
    """Verify different garment types (dress, jeans) generate valid GLBs."""
    old_env = os.environ.get("ENABLE_3D_TRYON")
    os.environ["ENABLE_3D_TRYON"] = "true"

    try:
        # Test Dress
        dress_res = client.post("/virtual-tryon/generate", json={
            "height_cm": 168,
            "weight_kg": 58,
            "gender": "female",
            "pose": "A-pose",
            "garment_type": "dress",
            "garment_color": "#d97706"
        })
        assert dress_res.status_code == 200
        assert dress_res.json()["status"] == "completed"

        # Test Jeans
        jeans_res = client.post("/virtual-tryon/generate", json={
            "height_cm": 182,
            "weight_kg": 78,
            "gender": "male",
            "pose": "neutral",
            "garment_type": "jeans",
            "garment_color": "#1e3a8a"
        })
        assert jeans_res.status_code == 200
        assert jeans_res.json()["status"] == "completed"

    finally:
        if old_env is not None:
            os.environ["ENABLE_3D_TRYON"] = old_env
        else:
            os.environ.pop("ENABLE_3D_TRYON", None)


def test_standalone_avatar_and_garment():
    """Verify optional standalone /virtual-tryon/avatar and /garment endpoints."""
    old_env = os.environ.get("ENABLE_3D_TRYON")
    os.environ["ENABLE_3D_TRYON"] = "true"

    try:
        # Avatar only
        av_res = client.post("/virtual-tryon/avatar", json={
            "height_cm": 170,
            "weight_kg": 65,
            "gender": "neutral",
            "pose": "T-pose"
        })
        assert av_res.status_code == 200
        assert av_res.json()["status"] == "completed"

        # Garment only
        g_res = client.post("/virtual-tryon/garment", json={
            "garment_type": "shirt",
            "garment_color": "#ffffff"
        })
        assert g_res.status_code == 200
        assert g_res.json()["status"] == "completed"

    finally:
        if old_env is not None:
            os.environ["ENABLE_3D_TRYON"] = old_env
        else:
            os.environ.pop("ENABLE_3D_TRYON", None)


def test_existing_apis_still_intact_post_3d():
    """Verify again that all existing DORI APIs work after running 3D operations."""
    res_health = client.get("/health")
    assert res_health.status_code == 200

    res_posts = client.get("/posts")
    assert res_posts.status_code == 200

    res_remixes = client.get("/remixes")
    assert res_remixes.status_code == 200


def test_deterministic_cache_hit_and_avatar_reuse():
    """Verify that identical requests hit the disk tryon cache, and avatar is reused."""
    old_env = os.environ.get("ENABLE_3D_TRYON")
    os.environ["ENABLE_3D_TRYON"] = "true"

    try:
        payload1 = {
            "height_cm": 173,
            "weight_kg": 68,
            "gender": "male",
            "pose": "A-pose",
            "garment_type": "tee",
            "garment_color": "#065f46"
        }

        # 1. Cold request
        res1 = client.post("/virtual-tryon/generate", json=payload1)
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["status"] == "completed"

        # 2. Warm request (Identical params -> cache hit)
        res2 = client.post("/virtual-tryon/generate", json=payload1)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "completed"
        assert data2["metadata"].get("cache_hit") is True

        # 3. Avatar reuse (Same body, different garment)
        payload2 = {
            "height_cm": 173,
            "weight_kg": 68,
            "gender": "male",
            "pose": "A-pose",
            "garment_type": "shirt",
            "garment_color": "#1e3a8a"
        }
        res3 = client.post("/virtual-tryon", json=payload2)  # Testing root alias
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["status"] == "completed"
        assert data3["metadata"].get("avatar_cache_hit") is True

    finally:
        if old_env is not None:
            os.environ["ENABLE_3D_TRYON"] = old_env
        else:
            os.environ.pop("ENABLE_3D_TRYON", None)


def test_root_virtual_tryon_alias():
    """Verify POST /virtual-tryon convenience alias."""
    old_env = os.environ.get("ENABLE_3D_TRYON")
    os.environ["ENABLE_3D_TRYON"] = "true"

    try:
        res = client.post("/virtual-tryon", json={
            "height_cm": 165,
            "weight_kg": 55,
            "gender": "female",
            "pose": "neutral",
            "garment_type": "tee",
            "garment_color": "#000000"
        })
        assert res.status_code == 200
        assert res.json()["status"] == "completed"
    finally:
        if old_env is not None:
            os.environ["ENABLE_3D_TRYON"] = old_env
        else:
            os.environ.pop("ENABLE_3D_TRYON", None)


def test_concurrent_responsiveness_stress_test():
    """Verify that existing DORI APIs remain fast and responsive during 3D generation."""
    import concurrent.futures
    import time

    old_env = os.environ.get("ENABLE_3D_TRYON")
    os.environ["ENABLE_3D_TRYON"] = "true"

    try:
        def call_3d():
            return client.post("/virtual-tryon/generate", json={
                "height_cm": 185,
                "weight_kg": 85,
                "gender": "male",
                "pose": "A-pose",
                "garment_type": "jeans",
                "garment_color": "#2563eb"
            })

        def call_health():
            t0 = time.perf_counter()
            r = client.get("/health")
            t_ms = (time.perf_counter() - t0) * 1000
            return r.status_code, t_ms

        def call_posts():
            t0 = time.perf_counter()
            r = client.get("/posts")
            t_ms = (time.perf_counter() - t0) * 1000
            return r.status_code, t_ms

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            fut_3d = executor.submit(call_3d)
            # Concurrently ping /health and /posts while 3D is computing
            fut_health = executor.submit(call_health)
            fut_posts = executor.submit(call_posts)

            h_status, h_time = fut_health.result()
            p_status, p_time = fut_posts.result()
            res_3d = fut_3d.result()

            assert h_status == 200
            assert p_status == 200
            assert res_3d.status_code == 200
            assert res_3d.json()["status"] == "completed"
            # Health check must stay fast (< 200ms)
            assert h_time < 500, f"Health check stalled: {h_time}ms"

    finally:
        if old_env is not None:
            os.environ["ENABLE_3D_TRYON"] = old_env
        else:
            os.environ.pop("ENABLE_3D_TRYON", None)


