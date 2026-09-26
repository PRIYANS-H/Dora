from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from datetime import datetime

class PostBase(BaseModel):
    designer_name: str
    designer_handle: str
    image_url: str
    title: str
    base_attributes: Dict[str, Any]
    price_reference: int

class PostResponse(PostBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class RemixCreate(BaseModel):
    post_id: str
    attributes: Dict[str, str]

class RemixResponse(BaseModel):
    id: str
    post_id: str
    user_label: str
    attributes: Dict[str, str]
    remixed_image_url: str
    created_at: datetime

    class Config:
        from_attributes = True

class TailorMatchRequest(BaseModel):
    attributes: Dict[str, str]
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

class CaptionRequest(BaseModel):
    tone: Optional[str] = "Creative"
    title: Optional[str] = ""
    image_url: Optional[str] = None
    image_data: Optional[str] = None
    api_key: Optional[str] = None

class CaptionResponse(BaseModel):
    caption: str
    tone: str
    model_used: Optional[str] = None

class ThreeDRequest(BaseModel):
    image_url: Optional[str] = None
    image_data: Optional[str] = None
    hf_token: Optional[str] = None
    meshy_api_key: Optional[str] = None
    engine: Optional[str] = "trellis"

class ThreeDResponse(BaseModel):
    glb_url: str
    engine: str
    status: str
    message: Optional[str] = None

class TryOnRequest(BaseModel):
    person_image_data: Optional[str] = None
    person_image_url: Optional[str] = None
    garment_image_url: Optional[str] = None
    garment_image_data: Optional[str] = None
    garment_description: Optional[str] = "couture dress"
    denoise_steps: Optional[int] = 20

class TryOnResponse(BaseModel):
    result_image_url: str
    status: str
    message: Optional[str] = None


