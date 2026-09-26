import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.database import get_db, init_db, SessionLocal
from app.models import Post, PostMedia, PostLike, PostComment, PostShare

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()
    yield

def create_sample_image_bytes(format="JPEG", size=(200, 200), color="blue"):
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    buf.seek(0)
    return buf.getvalue()

# ==========================================
# 1. Media Upload Tests
# ==========================================

def test_valid_image_upload():
    img_bytes = create_sample_image_bytes(format="JPEG")
    files = {"file": ("test_garment.jpg", img_bytes, "image/jpeg")}
    response = client.post("/media/upload", files=files)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["media_type"] == "image"
    assert data["mime_type"] == "image/jpeg"
    assert data["url"].startswith("/static/uploads/media/")
    assert data["width"] == 200
    assert data["height"] == 200
    assert data["file_size"] > 0

def test_valid_video_upload():
    # Mock video container with mp4 signature
    video_bytes = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + (b"\x00" * 1024)
    files = {"file": ("runway_walk.mp4", video_bytes, "video/mp4")}
    response = client.post("/media/upload", files=files)
    assert response.status_code == 201
    data = response.json()
    assert data["media_type"] == "video"
    assert data["mime_type"] == "video/mp4"
    assert data["url"].endswith(".mp4")

def test_invalid_file_type_rejection():
    text_bytes = b"Hello fashion world, this is a plain text file"
    files = {"file": ("notes.txt", text_bytes, "text/plain")}
    response = client.post("/media/upload", files=files)
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]

def test_corrupt_image_rejection():
    fake_img = b"fake image bytes not real jpg"
    files = {"file": ("broken.jpg", fake_img, "image/jpeg")}
    response = client.post("/media/upload", files=files)
    assert response.status_code == 400
    assert "Corrupt or invalid image file" in response.json()["detail"]

# ==========================================
# 2. Post Creation & Management Tests
# ==========================================

def test_create_post_with_media_and_caption():
    # 1. Upload media
    img_bytes = create_sample_image_bytes(color="red")
    upload_res = client.post("/media/upload", files={"file": ("red_blazer.jpg", img_bytes, "image/jpeg")})
    media_id = upload_res.json()["id"]

    # 2. Create post
    payload = {
        "caption": "Sculptural crimson tailoring with hand-pleated shoulder construction.",
        "media_ids": [media_id],
        "title": "Crimson Atelier Blazer",
        "price_reference": 480
    }
    headers = {
        "X-Designer-Id": "designer-sophia",
        "X-Designer-Name": "Sophia Thorne",
        "X-Designer-Handle": "@thorne_couture"
    }
    response = client.post("/posts", json=payload, headers=headers)
    assert response.status_code == 201
    post = response.json()
    assert post["id"] is not None
    assert post["caption"] == payload["caption"]
    assert post["designer"]["id"] == "designer-sophia"
    assert post["designer"]["name"] == "Sophia Thorne"
    assert len(post["media"]) == 1
    assert post["media"][0]["id"] == media_id
    assert post["likes_count"] == 0
    assert post["comments_count"] == 0

def test_create_post_without_caption():
    img_bytes = create_sample_image_bytes(color="gold")
    upload_res = client.post("/media/upload", files={"file": ("silk_cape.jpg", img_bytes, "image/jpeg")})
    media_id = upload_res.json()["id"]

    payload = {
        "media_ids": [media_id],
        "title": "Raw Silk Minimalist Drape"
    }
    response = client.post("/posts", json=payload)
    assert response.status_code == 201
    post = response.json()
    assert post["caption"] is None or post["caption"] == ""

def test_update_post_caption():
    # Create post
    create_res = client.post("/posts", json={"caption": "Initial sketch draft", "title": "Draft Design"}, headers={"X-Designer-Id": "designer-owner"})
    post_id = create_res.json()["id"]

    # Update caption with same owner
    update_res = client.patch(f"/posts/{post_id}", json={"caption": "Refined final runway edition"}, headers={"X-Designer-Id": "designer-owner"})
    assert update_res.status_code == 200
    assert update_res.json()["caption"] == "Refined final runway edition"

def test_unauthorized_post_update():
    create_res = client.post("/posts", json={"caption": "Owner caption"}, headers={"X-Designer-Id": "designer-owner"})
    post_id = create_res.json()["id"]

    # Attempt update by different designer
    update_res = client.patch(f"/posts/{post_id}", json={"caption": "Hacked caption"}, headers={"X-Designer-Id": "designer-other"})
    assert update_res.status_code == 403

def test_unauthorized_post_delete():
    create_res = client.post("/posts", json={"caption": "To delete"}, headers={"X-Designer-Id": "designer-owner"})
    post_id = create_res.json()["id"]

    # Attempt delete by different designer
    del_res = client.delete(f"/posts/{post_id}", headers={"X-Designer-Id": "designer-attacker"})
    assert del_res.status_code == 403

def test_authorized_post_delete():
    create_res = client.post("/posts", json={"caption": "To delete"}, headers={"X-Designer-Id": "designer-owner"})
    post_id = create_res.json()["id"]

    del_res = client.delete(f"/posts/{post_id}", headers={"X-Designer-Id": "designer-owner"})
    assert del_res.status_code == 200
    # Verify post no longer exists
    get_res = client.get(f"/posts/{post_id}")
    assert get_res.status_code == 404

# ==========================================
# 3. AI Caption Tests
# ==========================================

def test_ai_caption_with_invalid_media():
    response = client.post("/posts/generate-caption", json={"media_ids": ["non-existent-id-1234"]})
    assert response.status_code == 404

def test_ai_caption_with_invalid_tone():
    img_bytes = create_sample_image_bytes()
    upload_res = client.post("/media/upload", files={"file": ("test.jpg", img_bytes, "image/jpeg")})
    media_id = upload_res.json()["id"]

    response = client.post("/posts/generate-caption", json={"media_ids": [media_id], "tone": "invalid_tone_123"})
    assert response.status_code == 400
    assert "Invalid tone" in response.json()["detail"]

# ==========================================
# 4. Likes & Engagement Tests
# ==========================================

def test_like_and_unlike_flow():
    # Create post
    create_res = client.post("/posts", json={"caption": "Engagement test post"})
    post_id = create_res.json()["id"]

    # 1. Like post
    like_res = client.post(f"/posts/{post_id}/like", headers={"X-User-Id": "user-alex"})
    assert like_res.status_code == 200
    assert like_res.json()["liked"] is True
    assert like_res.json()["likes_count"] == 1

    # 2. Duplicate like (idempotency check)
    dup_res = client.post(f"/posts/{post_id}/like", headers={"X-User-Id": "user-alex"})
    assert dup_res.status_code == 200
    assert dup_res.json()["likes_count"] == 1

    # 3. Like from second user
    like2_res = client.post(f"/posts/{post_id}/like", headers={"X-User-Id": "user-maya"})
    assert like2_res.status_code == 200
    assert like2_res.json()["likes_count"] == 2

    # 4. Unlike from first user
    unlike_res = client.delete(f"/posts/{post_id}/like", headers={"X-User-Id": "user-alex"})
    assert unlike_res.status_code == 200
    assert unlike_res.json()["liked"] is False
    assert unlike_res.json()["likes_count"] == 1

# ==========================================
# 5. Comments Tests
# ==========================================

def test_comment_flow():
    create_res = client.post("/posts", json={"caption": "Comment flow post"})
    post_id = create_res.json()["id"]

    # 1. Post valid comment
    comment_payload = {"content": "The drape on this silk piece is magnificent."}
    comment_headers = {"X-User-Id": "user-clara", "X-User-Name": "Clara Oswald"}
    c_res = client.post(f"/posts/{post_id}/comments", json=comment_payload, headers=comment_headers)
    assert c_res.status_code == 201
    c_data = c_res.json()
    assert c_data["content"] == comment_payload["content"]
    assert c_data["user"]["name"] == "Clara Oswald"
    comment_id = c_data["id"]

    # 2. Get comments
    list_res = client.get(f"/posts/{post_id}/comments")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1
    assert list_res.json()[0]["id"] == comment_id

    # 3. Reject empty comment
    empty_res = client.post(f"/posts/{post_id}/comments", json={"content": "   "})
    assert empty_res.status_code == 422

    # 4. Delete unauthorized
    del_unauth = client.delete(f"/comments/{comment_id}", headers={"X-User-Id": "user-stranger"})
    assert del_unauth.status_code == 403

    # 5. Delete authorized
    del_auth = client.delete(f"/comments/{comment_id}", headers={"X-User-Id": "user-clara"})
    assert del_auth.status_code == 200

# ==========================================
# 6. Share Tests
# ==========================================

def test_share_post():
    create_res = client.post("/posts", json={"caption": "Share test"})
    post_id = create_res.json()["id"]

    share_res1 = client.post(f"/posts/{post_id}/share", headers={"X-User-Id": "user-1"})
    assert share_res1.status_code == 200
    assert share_res1.json()["shares_count"] == 1

    share_res2 = client.post(f"/posts/{post_id}/share", headers={"X-User-Id": "user-2"})
    assert share_res2.status_code == 200
    assert share_res2.json()["shares_count"] == 2

# ==========================================
# 7. Feed & Backward Compatibility Tests
# ==========================================

def test_paginated_feed():
    res = client.get("/posts?page=1&limit=5&sort=newest")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert data["page"] == 1
    assert len(data["items"]) <= 5
    assert data["total"] > 0
    # Validate item schema
    item = data["items"][0]
    assert "designer" in item
    assert "media" in item
    assert "likes_count" in item
    assert "comments_count" in item

def test_legacy_posts_endpoint_compatibility():
    # Calling /posts without page/limit should return a flat list for existing React FeedPage
    res = client.get("/posts")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    # Must have legacy keys expected by existing frontend:
    assert "title" in data[0]
    assert "designer_name" in data[0]
    assert "base_attributes" in data[0]
    assert "price_reference" in data[0]

def test_designer_posts_endpoint():
    res = client.get("/designers/designer-sophia/posts?page=1&limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    for item in data["items"]:
        assert item["designer"]["id"] == "designer-sophia"
