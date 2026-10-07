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
    role: str = UserRole.household.value
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LocationUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


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
    hub_id: Optional[str] = None


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
    contact_phone: Optional[str] = None
    auto_dispatch: bool = True
    gtin: Optional[str] = None  # barcode/EAN captured at scan → own-brand attribution


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
    contact_phone: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OTPRequest(BaseModel):
    phone_number: str
    role: Optional[UserRole] = None
    full_name: Optional[str] = None


class RoleUpdate(BaseModel):
    role: UserRole


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


class PickupOfferResponse(BaseModel):
    pickup_id: str
    listing_id: str
    material_name: str
    material_slug: str
    estimated_weight_kg: Optional[float] = None
    estimated_value_naira: Optional[float] = None
    toxicity_hazards: Optional[Any] = None
    address_text: Optional[str] = None
    distance_m: Optional[float] = None
    created_at: Optional[datetime] = None


class PickupJobResponse(PickupOfferResponse):
    status: str
    contact_phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    scheduled_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None


# ── Recycling Hub schemas ────────────────────────────────────────────


class RecyclingHubCreate(BaseModel):
    name: str
    address_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: str = "Zaria"
    contact_phone: Optional[str] = None


class RecyclingHubResponse(BaseModel):
    id: str
    owner_user_id: str
    name: str
    address_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: str
    contact_phone: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class HubRecyclingRequestCreate(BaseModel):
    material_category_id: int
    requested_kg: float = Field(gt=0)
    note: Optional[str] = None
    requested_on: datetime


class HubRecyclingRequestResponse(BaseModel):
    id: str
    hub_id: str
    hub_name: str
    material_category_id: int
    material_name: str
    requested_kg: float
    fulfilled_kg: float
    note: Optional[str] = None
    requested_on: str
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class HubDeliveryResponse(BaseModel):
    id: str
    hub_id: str
    request_id: str
    transaction_id: str
    material_category_id: int
    weight_kg: float
    hub_price_naira: float
    delivered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class HubSubscriptionCreate(BaseModel):
    plan_name: str = "Pro"
    amount_naira: float = Field(gt=0)
    payment_method: Optional[PaymentMethod] = PaymentMethod.cash
    payment_reference: Optional[str] = None


class HubSubscriptionResponse(BaseModel):
    id: str
    hub_id: str
    plan_name: str
    amount_naira: float
    cycle: str
    started_at: Optional[datetime] = None
    next_billing_at: Optional[datetime] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class HubRequestProgress(BaseModel):
    hub_id: str
    hub_name: str
    date: str
    requests: list[HubRecyclingRequestResponse]


# ── Compliance / Manifestoj schemas ──────────────────────────────────


class CompliancePartnerCreate(BaseModel):
    name: str
    partner_type: str = "pro"
    api_key: str
    brand_id: Optional[str] = None  # bound brand scope → own-product attribution only
    allow_category_aggregate: bool = False  # approved anonymized category totals


class CompliancePartnerResponse(BaseModel):
    id: str
    name: str
    partner_type: str
    is_active: bool
    brand_id: Optional[str] = None
    brand_name: Optional[str] = None
    allow_category_aggregate: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Producer registers their own product catalog under a Brand; only identifiers
# listed here (GTIN/EAN/SKU) map to that brand (own-product attribution rule).
class BrandCatalogItem(BaseModel):
    gtin: str
    sku: Optional[str] = None
    product: Optional[str] = None


class BrandCreate(BaseModel):
    name: str
    catalog: list[BrandCatalogItem] = Field(default_factory=list)
    owner_user_id: Optional[str] = None


class BrandResponse(BaseModel):
    id: str
    name: str
    owner_id: Optional[str] = None
    catalog: list[BrandCatalogItem] = Field(default_factory=list)
    is_active: bool = True
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ComplianceValidateResponse(BaseModel):
    """Self/validate payload returned to the signup gate — proves a live
    subscription (valid X-API-Key) and reveals exactly what the key grants:
    own-brand detail + approved anonymized category aggregate."""

    partner_id: str
    partner_name: str
    partner_type: str
    is_active: bool
    brand_id: Optional[str] = None
    brand_name: Optional[str] = None
    allow_category_aggregate: bool = False
    scope: str = "all"  # own_brand | all
    plan_label: str = "Compliance API"


class CategoryAggregateItem(BaseModel):
    """Anonymised category totals for benchmarking — no collector identity."""

    material_slug: str
    material_name: str
    transaction_count: int
    tonnage_kg: float
    carbon_offset_kg_co2e: float
    collector_income_naira: float


class ManifestoItem(BaseModel):
    transaction_id: str
    collector_id: str
    collector_phone: str
    material_slug: str
    material_name: str
    weight_kg: float
    gross_value_naira: float
    carbon_offset_kg_co2e: float
    hub: Optional[str] = None
    settled_at: Optional[str] = None
    brand_id: Optional[str] = None
    brand_name: Optional[str] = None
    gtin: Optional[str] = None


class ComplianceManifestoResponse(BaseModel):
    partner_id: str
    partner_name: str
    partner_type: str
    generated_at: str
    scope: str = "all"  # own_brand | all
    allow_category_aggregate: bool = False
    total_transactions: int
    total_tonnage_kg: float
    total_carbon_offset_kg_co2e: float
    total_collector_income_naira: float
    items: list[ManifestoItem]
    category_aggregate: Optional[list[CategoryAggregateItem]] = None
