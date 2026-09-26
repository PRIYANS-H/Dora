import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from app.models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dora.db")

# SQLite specific connect args
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Automatically add missing columns in SQLite if table already exists
    try:
        with engine.connect() as conn:
            inspector = inspect(engine)
            if "posts" in inspector.get_table_names():
                existing_cols = {c["name"] for c in inspector.get_columns("posts")}
                if "caption" not in existing_cols:
                    conn.execute(text("ALTER TABLE posts ADD COLUMN caption TEXT"))
                if "designer_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE posts ADD COLUMN designer_id VARCHAR"))
                if "designer_avatar" not in existing_cols:
                    conn.execute(text("ALTER TABLE posts ADD COLUMN designer_avatar VARCHAR"))
                if "is_published" not in existing_cols:
                    conn.execute(text("ALTER TABLE posts ADD COLUMN is_published BOOLEAN DEFAULT 1"))
                if "updated_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE posts ADD COLUMN updated_at DATETIME"))
                conn.commit()
    except Exception as e:
        print(f"[Database] Migration note: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
