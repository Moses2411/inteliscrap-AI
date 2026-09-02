from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models import PaymentMethod, UserRole


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


class SettlementRequest(BaseModel):
    weight_kg: float = Field(gt=0)
    unit_price_naira: Optional[float] = None
    payment_method: Optional[PaymentMethod] = PaymentMethod.cash


class TransactionResponse(BaseModel):
    id: str
    pickup_id: str
    seller_id: str
    collector_id: str
    material_category_id: int
    weight_kg: float
    unit_price_naira: float
    gross_value_naira: float
    platform_fee_naira: float
    collector_earnings_naira: float
    seller_payout_naira: float
    payment_method: Optional[str] = None
    status: str
    settled_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ImpactSummary(BaseModel):
    total_tonnage_kg: float
    total_carbon_offset_kg_co2e: float
    total_collector_income_naira: float
    transactions_count: int


class ImpactDailyPoint(BaseModel):
    period: str
    tonnage_kg: float
    carbon_offset_kg_co2e: float
    collector_income_naira: float


class ImpactByMaterial(BaseModel):
    material: str
    tonnage_kg: float
    carbon_offset_kg_co2e: float


class ListingCreate(BaseModel):
    material_category_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    estimated_weight_kg: Optional[float] = None
    estimated_value_naira: Optional[float] = None
    confidence_score: float = 0.0
    toxicity_hazards: Optional[list[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address_text: Optional[str] = None
    auto_dispatch: bool = True


class ListingResponse(BaseModel):
    id: str
    seller_id: str
    material_category_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    estimated_weight_kg: Optional[float] = None
    actual_weight_kg: Optional[float] = None
    estimated_value_naira: Optional[float] = None
    final_value_naira: Optional[float] = None
    confidence_score: float
    toxicity_hazards: Optional[Any] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address_text: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OTPRequest(BaseModel):
    phone_number: str
    role: Optional[UserRole] = UserRole.household
    full_name: Optional[str] = None


class OTPVerify(BaseModel):
    phone_number: str
    otp_code: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str


class MaterialCategoryResponse(BaseModel):
    id: int
    slug: str
    name: str
    name_ha: Optional[str] = None
    name_pcm: Optional[str] = None
    price_per_kg_naira: float
    is_hazardous: bool = False

    model_config = ConfigDict(from_attributes=True)
