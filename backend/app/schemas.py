from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime

# ==========================================
# Legacy / Existing Core Schemas
# ==========================================

class PostBase(BaseModel):
    designer_name: str
    designer_handle: str
    image_url: str
    title: str
    base_attributes: Dict[str, Any] = Field(default_factory=dict)
    price_reference: int = 250

class PostResponse(PostBase):
    id: str
    created_at: datetime
    caption: Optional[str] = None
    designer_id: Optional[str] = None
    designer_avatar: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    media: List[Any] = Field(default_factory=list)

    class Config:
        from_attributes = True

class RemixCreate(BaseModel):
    post_id: str
    attributes: Dict[str, Any]

class RemixResponse(BaseModel):
    id: str
    post_id: str
    user_label: str
    attributes: Dict[str, Any]
    remixed_image_url: str
    created_at: datetime

    class Config:
        from_attributes = True

class TailorMatchRequest(BaseModel):
    attributes: Dict[str, Any]
    lat: Optional[float] = 37.7749
    lng: Optional[float] = -122.4194

class SubScoreBreakdown(BaseModel):
    skill_overlap: float
    distance_score: float
    rating_score: float
    portfolio_overlap: float

class TailorMatchResponse(BaseModel):
    id: str
    name: str
    photo_url: str
    skills: List[str]
    lat: float
    lng: float
    rating: float
    reviews_count: int
    price_band: str
    portfolio_tags: List[str]
    match_score: float
    breakdown: SubScoreBreakdown

class OrderCreate(BaseModel):
    remix_id: str
    tailor_id: str
    measurements: Dict[str, Any]

class OrderStatusUpdate(BaseModel):
    status: str

class OrderResponse(BaseModel):
    id: str
    remix_id: str
    tailor_id: str
    match_score: float
    measurements: Dict[str, Any]
    status: str
    created_at: datetime
    remix: Optional[Dict[str, Any]] = None
    tailor: Optional[Dict[str, Any]] = None
    post: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class RoyaltyReceiptResponse(BaseModel):
    order_id: str
    price_reference: int
    designer_amount: float
    tailor_amount: float
    platform_amount: float
    designer_share_pct: int = 15
    tailor_share_pct: int = 70
    platform_share_pct: int = 15


# ==========================================
# New Social Feed, Media, AI & Engagement Schemas
# ==========================================

class MediaResponse(BaseModel):
    id: str
    post_id: Optional[str] = None
    media_type: str  # 'image' | 'video'
    file_name: str
    url: str
    mime_type: str
    file_size: int
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MediaUploadResponse(BaseModel):
    id: str
    url: str
    media_type: str
    file_name: str
    mime_type: str
    file_size: int
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None

class DesignerProfile(BaseModel):
    id: str
    name: str
    handle: str
    profile_image: Optional[str] = None

class PostCreate(BaseModel):
    caption: Optional[str] = Field(None, max_length=2200)
    media_ids: List[str] = Field(default_factory=list)
    generate_ai_caption: bool = False
    title: Optional[str] = Field(None, max_length=150)
    base_attributes: Optional[Dict[str, Any]] = Field(default_factory=dict)
    price_reference: Optional[int] = 250

class PostUpdate(BaseModel):
    caption: Optional[str] = Field(None, max_length=2200)
    is_published: Optional[bool] = None

class PostDetailResponse(BaseModel):
    id: str
    designer: DesignerProfile
    media: List[MediaResponse]
    caption: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    liked_by_current_user: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_published: bool = True
    
    # Backwards compatibility fields for DORI Remix & Tailor Match
    title: str = "Couture Garment"
    designer_name: str = "Elena Rostova"
    designer_handle: str = "@elena_couture"
    image_url: str = ""
    base_attributes: Dict[str, Any] = Field(default_factory=dict)
    price_reference: int = 250

    class Config:
        from_attributes = True

class PaginatedFeedResponse(BaseModel):
    items: List[PostDetailResponse]
    page: int
    limit: int
    total: int

class CaptionGenerateRequest(BaseModel):
    media_ids: List[str]
    tone: Optional[str] = Field("creative", description="One of: professional, creative, minimal, luxury, casual, streetwear")

class CaptionGenerateResponse(BaseModel):
    caption: str
    tone: str
    media_count: int

class LikeResponse(BaseModel):
    post_id: str
    likes_count: int
    liked: bool

class CommentAuthor(BaseModel):
    id: str
    name: str
    avatar: Optional[str] = None

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500, description="Comment body")

class CommentResponse(BaseModel):
    id: str
    post_id: str
    user: CommentAuthor
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ShareResponse(BaseModel):
    post_id: str
    shares_count: int
