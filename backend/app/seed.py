import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, init_db
from app.models import Post, Tailor, Remix, Order
from app.seed_data import POSTS_SEED, TAILORS_SEED

def seed_database():
    print("[Seed] Initializing database tables...")
    init_db()
    db = SessionLocal()

    try:
        # Clear existing seed items if needed
        db.query(Post).delete()
        db.query(Tailor).delete()
        db.commit()

        # Seed Posts
        for p_data in POSTS_SEED:
            post = Post(**p_data)
            db.add(post)

        # Seed Tailors
        for t_data in TAILORS_SEED:
            tailor = Tailor(**t_data)
            db.add(tailor)

        db.commit()
        print(f"[Seed] Successfully seeded {len(POSTS_SEED)} posts and {len(TAILORS_SEED)} tailor profiles!")
    except Exception as e:
        db.rollback()
        print(f"[Seed] Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
