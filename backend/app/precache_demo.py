import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, init_db
from app.models import Post, Remix
from app.services.remix_engine import generate_remixed_image

PRECACHED_COMBOS = [
    {
        "post_id": "post-001",
        "attributes": {
            "neckline": "v-neck",
            "sleeves": "sleeveless",
            "fabric": "mulberry silk",
            "color": "emerald",
            "fit": "slim"
        }
    },
    {
        "post_id": "post-001",
        "attributes": {
            "neckline": "sweetheart",
            "sleeves": "off-shoulder",
            "fabric": "cotton velvet",
            "color": "burgundy",
            "fit": "tailored"
        }
    },
    {
        "post_id": "post-002",
        "attributes": {
            "neckline": "mandarin",
            "sleeves": "full",
            "fabric": "raw linen",
            "color": "earth tones",
            "fit": "oversized"
        }
    },
    {
        "post_id": "post-003",
        "attributes": {
            "neckline": "funnel neck",
            "sleeves": "cape slit",
            "fabric": "heavy cotton twill",
            "color": "onyx",
            "fit": "draped"
        }
    }
]

def precache_demo_remixes():
    print("[Precache] Initializing demo remix cache...")
    init_db()
    db = SessionLocal()

    try:
        for combo in PRECACHED_COMBOS:
            post = db.query(Post).filter(Post.id == combo["post_id"]).first()
            if post:
                url = generate_remixed_image(
                    post_id=post.id,
                    base_image_url=post.image_url,
                    base_attributes=post.base_attributes,
                    new_attributes=combo["attributes"]
                )
                
                # Check if already in DB
                existing = db.query(Remix).filter(
                    Remix.post_id == post.id,
                    Remix.remixed_image_url == url
                ).first()

                if not existing:
                    remix = Remix(
                        post_id=post.id,
                        user_label="Rehearsed Demo User",
                        attributes=combo["attributes"],
                        remixed_image_url=url
                    )
                    db.add(remix)
        db.commit()
        print(f"[Precache] Successfully pre-cached {len(PRECACHED_COMBOS)} demo remix combinations!")
    except Exception as e:
        db.rollback()
        print(f"[Precache] Error precaching: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    precache_demo_remixes()
