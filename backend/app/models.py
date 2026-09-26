import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, JSON, Text, Boolean,
    ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=generate_uuid)
    designer_id = Column(String, index=True, nullable=True)
    designer_name = Column(String, nullable=False, default="Elena Rostova")
    designer_handle = Column(String, nullable=False, default="@elena_couture")
    designer_avatar = Column(String, nullable=True)
    title = Column(String, nullable=False, default="Couture Garment")
    caption = Column(Text, nullable=True)
    image_url = Column(String, nullable=False, default="/static/uploads/media/default.jpg")
    base_attributes = Column(JSON, nullable=False, default=dict)
    price_reference = Column(Integer, nullable=False, default=250)
    is_published = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    media = relationship("PostMedia", back_populates="post", cascade="all, delete-orphan", order_by="PostMedia.created_at")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("PostComment", back_populates="post", cascade="all, delete-orphan", order_by="PostComment.created_at.desc()")
    shares = relationship("PostShare", back_populates="post", cascade="all, delete-orphan")


class PostMedia(Base):
    __tablename__ = "post_media"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=True, index=True)
    media_type = Column(String, nullable=False)  # 'image' | 'video'
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    url = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)  # bytes
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)  # seconds for video
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    post = relationship("Post", back_populates="media")


class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_user_like"),
    )

    post = relationship("Post", back_populates="likes")


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    user_name = Column(String, nullable=False, default="Fashion Enthusiast")
    user_avatar = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    post = relationship("Post", back_populates="comments")


class PostShare(Base):
    __tablename__ = "post_shares"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="shares")


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
    measurements = Column(JSON, nullable=False)
    status = Column(String, nullable=False, default="placed")
    created_at = Column(DateTime, default=datetime.utcnow)
