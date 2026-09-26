"""
Pydantic schemas for DORI 3D Virtual Try-On Module.
"""

from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
import re

class GarmentMeasurements(BaseModel):
    chest: float = Field(default=96.0, ge=40.0, le=180.0, description="Chest circumference in cm")
    waist: float = Field(default=82.0, ge=40.0, le=180.0, description="Waist circumference in cm")
    hip: float = Field(default=98.0, ge=40.0, le=180.0, description="Hip circumference in cm")
    length: float = Field(default=68.0, ge=20.0, le=200.0, description="Garment length in cm")
    sleeve: Optional[float] = Field(default=22.0, ge=0.0, le=100.0, description="Sleeve length in cm")
    rise: Optional[float] = Field(default=28.0, ge=10.0, le=60.0, description="Pants rise in cm")

    model_config = {"extra": "ignore"}


class VirtualTryOnRequest(BaseModel):
    height_cm: float = Field(default=175.0, ge=100.0, le=250.0, description="User body height in cm")
    weight_kg: float = Field(default=70.0, ge=30.0, le=250.0, description="User body weight in kg")
    gender: Literal["neutral", "male", "female"] = Field(default="neutral", description="Body morphology profile")
    pose: Literal["neutral", "A-pose", "T-pose", "hands-down"] = Field(default="A-pose", description="Avatar standing pose preset")
    garment_type: Literal["tee", "shirt", "dress", "jeans"] = Field(default="tee", description="Garment template type")
    garment_color: str = Field(default="#111111", description="Hex color code (e.g. #111111 or #d97706)")
    garment_measurements: Optional[GarmentMeasurements] = Field(default=None, description="Optional custom garment dimensions")
    fabric: Optional[str] = Field(default="cotton", description="Fabric name")

    @field_validator("garment_color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", v):
            return "#111111"
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "height_cm": 175,
                "weight_kg": 70,
                "gender": "neutral",
                "pose": "A-pose",
                "garment_type": "tee",
                "garment_color": "#111111",
                "garment_measurements": {
                    "chest": 96,
                    "waist": 82,
                    "hip": 98,
                    "length": 68,
                    "sleeve": 22
                }
            }
        }
    }


class AvatarOnlyRequest(BaseModel):
    height_cm: float = Field(default=175.0, ge=100.0, le=250.0)
    weight_kg: float = Field(default=70.0, ge=30.0, le=250.0)
    gender: Literal["neutral", "male", "female"] = "neutral"
    pose: Literal["neutral", "A-pose", "T-pose", "hands-down"] = "A-pose"


class GarmentOnlyRequest(BaseModel):
    garment_type: Literal["tee", "shirt", "dress", "jeans"] = "tee"
    garment_color: str = "#111111"
    garment_measurements: Optional[GarmentMeasurements] = None

    @field_validator("garment_color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", v):
            return "#111111"
        return v


class VirtualTryOnJobResponse(BaseModel):
    job_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    model_url: Optional[str] = None
    created_at: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class TryOnDisabledResponse(BaseModel):
    status: str = "disabled"
    detail: str = "3D Virtual Try-On feature is currently disabled. Set ENABLE_3D_TRYON=true in .env to enable."
    docs_url: str = "/docs#/3D%20Virtual%20Try-On"


class ModuleHealthResponse(BaseModel):
    status: str
    enabled: bool
    mode: str = "basic"
    blender_available: bool
    smplx_configured: bool
    models_directory: str
    workers: int = 1
    max_queue: int = 5
