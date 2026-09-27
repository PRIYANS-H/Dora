from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime

class PostBase(BaseModel):
    designer_name: str
    designer_handle: str
    image_url: str
    title: str
    base_attributes: Dict[str, str]
    price_reference: int

class ProfileCreate(BaseModel):
    username: str
    full_name: str
    bio: str = ""
    avatar_url: Optional[str] = None
    is_professional: bool = False
    skills: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_professional: Optional[bool] = None
    skills: Optional[List[str]] = None
    location: Optional[str] = None
    phone_number: Optional[str] = None
    phone_visible_to_order_partners: Optional[bool] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

class ProfilePublic(BaseModel):
    id: str
    username: str
    full_name: str
    bio: str = ""
    avatar_url: Optional[str] = None
    is_professional: bool = False
    skills: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    created_at: Optional[datetime] = None

class CommentCreate(BaseModel):
    body: str
    parent_id: Optional[str] = None

class GarmentTypeInput(BaseModel):
    name: str
    category: str
    description: str = ""
    active: bool = True
    image_url: Optional[str] = None
    post_id: Optional[str] = None

class FabricInput(BaseModel):
    name: str
    description: str = ""
    composition: str = ""
    color: str = ""
    image_url: Optional[str] = None
    price_delta_minor: int = 0
    currency: str = "INR"
    available_quantity: Optional[int] = None
    active: bool = True

class MeasurementProfileInput(BaseModel):
    label: str
    fit_template: str
    unit: str
    measurements: Dict[str, float]

class OrderMessageCreate(BaseModel):
    body: str

class OrderQuoteCreate(BaseModel):
    amount_minor: int
    currency: str = "INR"
    estimated_days: Optional[int] = None
    message: str = ""

class RazorpaySettingsInput(BaseModel):
    key_id: str = Field(..., min_length=8, max_length=80)
    key_secret: Optional[str] = Field(None, max_length=512)

class RazorpayPaymentVerify(BaseModel):
    razorpay_order_id: str = Field(..., min_length=8, max_length=80)
    razorpay_payment_id: str = Field(..., min_length=8, max_length=80)
    razorpay_signature: str = Field(..., min_length=32, max_length=256)

class PostCreate(BaseModel):
    title: str
    image_url: str
    caption: str = ""
    garment_type: str = "custom"
    base_attributes: Dict[str, str] = Field(default_factory=dict)
    price_reference: int = 0
    starting_price_minor: int = 0
    currency: str = "INR"
    tailor_id: Optional[str] = None

class CaptionGenerateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    garment_type: str = Field(default="custom", max_length=80)
    base_attributes: Dict[str, str] = Field(default_factory=dict)

class PostUpdate(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    image_url: Optional[str] = None
    garment_type: Optional[str] = None
    base_attributes: Optional[Dict[str, str]] = None
    price_reference: Optional[int] = None
    starting_price_minor: Optional[int] = None
    currency: Optional[str] = None

class PostResponse(PostBase):
    id: str
    tailor_id: Optional[str] = None
    profile_id: Optional[str] = None
    caption: str = ""
    garment_type: str = "custom"
    starting_price_minor: int = 0
    currency: str = "INR"
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
    profile_id: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
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
    measurement_profile_id: Optional[str] = None
    customer_note: str = ""
    garment_type: Optional[str] = None
    phone_number: Optional[str] = None
    fabric_id: Optional[str] = None

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
