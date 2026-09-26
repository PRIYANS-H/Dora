"""
DORI — Supabase Seed Script
Run: python -m app.seed   (from the backend/ directory)
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from app.database import get_supabase
from app.seed_data import POSTS_SEED, TAILORS_SEED


def seed_database():
    sb = get_supabase()

    # ── Posts ──────────────────────────────────────────────────────────────
    for p in POSTS_SEED:
        sb.table("posts").upsert(p).execute()
    print(f"  Upserted {len(POSTS_SEED)} posts (with tailor linkages).")

    # ── Tailors ────────────────────────────────────────────────────────────
    existing_tailors = sb.table("tailors").select("id").execute()
    existing_tailor_ids = {r["id"] for r in (existing_tailors.data or [])}

    tailors_to_insert = [t for t in TAILORS_SEED if t["id"] not in existing_tailor_ids]
    if tailors_to_insert:
        sb.table("tailors").insert(tailors_to_insert).execute()
        print(f"  Seeded {len(tailors_to_insert)} tailors.")
    else:
        print("  Tailors already seeded — skipping.")

    print("  Database seeding complete.")


if __name__ == "__main__":
    print("Seeding Supabase database...")
    seed_database()
    print("Done.")
