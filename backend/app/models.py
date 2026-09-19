import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, Text, ARRAY
from sqlalchemy.orm import declarative_base

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=generate_uuid)
    designer_name = Column(String, nullable=False)
    designer_handle = Column(String, nullable=False)
    image_url = Column(String, nullable=False)
    title = Column(String, nullable=False)
    base_attributes = Column(JSON, nullable=False)  # {"neckline": "mandarin", "sleeves": "full", ...}
    price_reference = Column(Integer, nullable=False, default=250)
    created_at = Column(DateTime, default=datetime.utcnow)

class Remix(Base):
    __tablename__ = "remixes"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, nullable=False)
    user_label = Column(String, default="Demo User")
    attributes = Column(JSON, nullable=False)
    remixed_image_url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Tailor(Base):
    __tablename__ = "tailors"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    photo_url = Column(String, nullable=False)
    skills = Column(JSON, nullable=False)  # JSON array for SQLite compatibility
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    rating = Column(Float, nullable=False, default=4.8)
    reviews_count = Column(Integer, default=42)
    price_band = Column(String, default="mid")  # budget | mid | premium
    portfolio_tags = Column(JSON, nullable=False)

class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=generate_uuid)
    remix_id = Column(String, nullable=False)
    tailor_id = Column(String, nullable=False)
    match_score = Column(Float, nullable=False)
    measurements = Column(JSON, nullable=False)  # {"chest": 38, "length": 42, "shoulder": 17, "sleeve": 24}
    status = Column(String, nullable=False, default="placed")  # placed | accepted | stitching | ready | delivered
    created_at = Column(DateTime, default=datetime.utcnow)
