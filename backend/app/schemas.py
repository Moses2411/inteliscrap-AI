from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class ScrapScanCreate(BaseModel):
    id: str
    material_class: str
    sub_grade: Optional[str] = None
    weight_est_kg: Optional[float] = None
    estimated_naira_value: float
    confidence_score: float = 1.0
    toxicity_hazards: Optional[list[str]] = None
    safety_instructions: Optional[str] = None
    captured_at: datetime
    is_deleted: bool = False


class ScrapScanResponse(BaseModel):
    id: str
    material_class: str
    sub_grade: Optional[str] = None
    weight_est_kg: Optional[float] = None
    estimated_naira_value: float
    confidence_score: float
    toxicity_hazards: Optional[Any] = None
    safety_instructions: Optional[str] = None
    captured_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    is_deleted: bool = False

    model_config = ConfigDict(from_attributes=True)


class SyncPayload(BaseModel):
    user_id: str
    local_scans: list[ScrapScanCreate]


class PriceMatrixItem(BaseModel):
    material_class: str
    price_per_kg_naira: float


class SyncResponse(BaseModel):
    status: str
    synced_ids: list[str]
    latest_prices: list[PriceMatrixItem]
    server_time: datetime


class UserCreate(BaseModel):
    id: str = Field(default="")
    phone_number: str
    full_name: Optional[str] = None
    location_hub: str = "Zaria"


class UserResponse(BaseModel):
    id: str
    phone_number: str
    full_name: Optional[str] = None
    location_hub: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PriceMatrixUpdate(BaseModel):
    material_class: str
    price_per_kg_naira: float
    updated_by: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str


class AnalyzeRequest(BaseModel):
    image_base64: str


class AnalyzeResponse(BaseModel):
    material_class: str
    confidence: float
    toxicity_hazards: list[str]
    safety_instructions: str
    estimated_value: float = 0
