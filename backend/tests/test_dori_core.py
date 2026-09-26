import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.json()["tagline"] == "See it. Remix it. Wear it."

def test_tailor_match():
    payload = {
        "attributes": {
            "neckline": "mandarin",
            "sleeves": "full",
            "fabric": "heavy cotton twill",
            "color": "onyx"
        },
        "lat": 37.7749,
        "lng": -122.4194
    }
    res = client.post("/tailors/match", json=payload)
    assert res.status_code == 200
    tailors = res.json()
    assert len(tailors) > 0
    assert "match_score" in tailors[0]
    assert "breakdown" in tailors[0]
    assert "skill_overlap" in tailors[0]["breakdown"]

def test_remix_and_order_flow():
    # 1. Fetch posts to find a base post
    posts_res = client.get("/posts")
    assert posts_res.status_code == 200
    posts = posts_res.json()
    assert len(posts) > 0
    base_post = posts[0]

    # 2. Create a remix
    remix_payload = {
        "post_id": base_post["id"],
        "attributes": {
            "neckline": "sweetheart",
            "sleeves": "bell",
            "fabric": "mulberry silk",
            "color": "emerald"
        }
    }
    remix_res = client.post("/remix", json=remix_payload)
    assert remix_res.status_code == 200
    remix = remix_res.json()
    assert remix["id"] is not None
    assert remix["remixed_image_url"] != ""

    # 3. Match tailors for this remix
    match_res = client.post("/tailors/match", json={"attributes": remix["attributes"]})
    assert match_res.status_code == 200
    tailor = match_res.json()[0]

    # 4. Place order
    order_payload = {
        "remix_id": remix["id"],
        "tailor_id": tailor["id"],
        "measurements": {"chest": 38, "length": 42, "shoulder": 17, "sleeve": 24}
    }
    order_res = client.post("/orders", json=order_payload)
    assert order_res.status_code == 200
    order = order_res.json()
    assert order["status"] == "placed"
    order_id = order["id"]

    # 5. Get receipt
    receipt_res = client.get(f"/orders/{order_id}/receipt")
    assert receipt_res.status_code == 200
    receipt = receipt_res.json()
    assert receipt["tailor_share_pct"] == 70
    assert receipt["designer_share_pct"] == 15
    assert receipt["platform_share_pct"] == 15

    # 6. Update order status (Tailor operator view)
    status_res = client.patch(f"/orders/{order_id}/status", json={"status": "stitching"})
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "stitching"
