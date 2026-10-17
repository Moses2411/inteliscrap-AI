import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _db_enum(enum_cls: type[enum.Enum], length: int = 20) -> Enum:
    return Enum(
        enum_cls,
        native_enum=False,
        length=length,
        values_callable=lambda x: [member.value for member in x],
    )


class UserRole(str, enum.Enum):
    seller = "seller"
    collector = "collector"
    admin = "admin"
    ngo = "ngo"
    recycling_hub = "recycling_hub"
    partner = "partner"


class SubscriptionPlan(str, enum.Enum):
    freemium = "freemium"
    quarterly = "quarterly"
    seller_yearly = "seller_yearly"
    ngo_yearly = "ngo_yearly"
    epr_yearly = "epr_yearly"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"
    pending = "pending"


class HubSubscriptionStatus(str, enum.Enum):
    active = "active"
    past_due = "past_due"
    cancelled = "cancelled"
    trial = "trial"


class ListingStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    matched = "matched"
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    expired = "expired"


class PickupStatus(str, enum.Enum):
    offered = "offered"
    accepted = "accepted"
    rejected = "rejected"
    en_route = "en_route"
    arrived = "arrived"
    verified = "verified"
    pending_confirmation = "pending_confirmation"
    disputed = "disputed"
    completed = "completed"
    cancelled = "cancelled"
    expired = "expired"


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    settled = "settled"
    disputed = "disputed"
    cancelled = "cancelled"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    mobile_money = "mobile_money"
    bank_transfer = "bank_transfer"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    successful = "successful"
    failed = "failed"
    cancelled = "cancelled"


class PaymentPurpose(str, enum.Enum):
    user_subscription = "user_subscription"
    hub_subscription = "hub_subscription"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=True)
    role = Column(_db_enum(UserRole), nullable=False, default=UserRole.seller, index=True)
    language_pref = Column(String(8), nullable=False, default="ha")
    location_hub = Column(String(64), default="Zaria")
    address_text = Column(String(320), nullable=True)  # Full address for pickup/delivery
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    h3_cell = Column(String(16), nullable=True, index=True)
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    last_seen_at = Column(DateTime, nullable=True)
    device_id = Column(String(64), nullable=True)
    # Subscription fields
    subscription_plan = Column(_db_enum(SubscriptionPlan), nullable=False, default=SubscriptionPlan.freemium, index=True)
    subscription_status = Column(_db_enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.active, index=True)
    subscription_expires_at = Column(DateTime, nullable=True)
    listings_this_week = Column(Integer, nullable=False, default=0)
    listings_week_start = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    scans = relationship("ScrapScan", back_populates="owner", cascade="all, delete-orphan")
    listings = relationship("Listing", foreign_keys="Listing.seller_id", back_populates="seller")
    pickups = relationship("Pickup", foreign_keys="Pickup.collector_id", back_populates="collector")
    sold_transactions = relationship(
        "Transaction", foreign_keys="Transaction.seller_id", back_populates="seller"
    )
    collected_transactions = relationship(
        "Transaction", foreign_keys="Transaction.collector_id", back_populates="collector"
    )
    subscriptions = relationship("UserSubscription", back_populates="user", cascade="all, delete-orphan")


class MaterialCategory(Base):
    __tablename__ = "material_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(60), unique=True, nullable=False, index=True)
    name = Column(String(80), nullable=False)
    name_ha = Column(String(80), nullable=True)
    name_pcm = Column(String(80), nullable=True)
    grade = Column(String(40), nullable=True)
    unit = Column(String(16), nullable=False, default="kg")
    price_per_kg_naira = Column(Numeric(12, 2), nullable=False)
    carbon_kg_co2e_per_kg = Column(Numeric(10, 4), nullable=False, default=0)
    is_hazardous = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    updated_by = Column(String(36), nullable=True)
    price_last_updated_at = Column(DateTime, nullable=True, default=datetime.utcnow)
    price_source = Column(String(32), nullable=False, default="seed")
    price_version = Column(Integer, nullable=False, default=1)
    price_updated_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    listings = relationship("Listing", back_populates="material_category")
    price_updated_by = relationship("User", foreign_keys=[price_updated_by_id])


class PriceHistory(Base):
    """Append-only audit trail for every material price change.

    Never mutated or deleted in normal operation — this is the record EPR/NGO
    audits can rely on to reconstruct what a material was priced at, and when.
    """

    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    material_category_id = Column(
        Integer, ForeignKey("material_categories.id"), nullable=False, index=True
    )
    price_per_kg_naira = Column(Numeric(12, 2), nullable=False)
    carbon_kg_co2e_per_kg = Column(Numeric(10, 4), nullable=False, default=0)
    source = Column(String(32), nullable=False, default="admin")
    reason = Column(String(255), nullable=True)
    updated_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    material_category = relationship("MaterialCategory")
    updated_by = relationship("User", foreign_keys=[updated_by_id])


class Listing(Base):
    __tablename__ = "listings"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    seller_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    material_category_id = Column(
        Integer, ForeignKey("material_categories.id"), nullable=False, index=True
    )
    # Brand / own-product attribution captured at scan: an optional GTIN/EAN
    # barcode that (when it matches a producer's registered catalog) maps to brand_id.
    brand_id = Column(String(36), ForeignKey("brands.id"), nullable=True, index=True)
    gtin = Column(String(64), nullable=True, index=True)
    title = Column(String(160), nullable=True)
    description = Column(Text, nullable=True)
    photo_url = Column(String(512), nullable=True)
    thumbnail_url = Column(String(512), nullable=True)
    estimated_weight_kg = Column(Numeric(10, 3), nullable=True)
    actual_weight_kg = Column(Numeric(10, 3), nullable=True)
    estimated_value_naira = Column(Numeric(12, 2), nullable=True)
    final_value_naira = Column(Numeric(12, 2), nullable=True)
    confidence_score = Column(Float, nullable=False, default=0.0)
    toxicity_hazards = Column(JSON, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address_text = Column(String(320), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    status = Column(_db_enum(ListingStatus), nullable=False, default=ListingStatus.active, index=True)
    expires_at = Column(DateTime, nullable=True)
    # Subscription enforcement fields
    is_large_quantity = Column(Boolean, nullable=False, default=False)  # > 100kg or subscription required
    listing_fee_naira = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    seller = relationship("User", foreign_keys=[seller_id], back_populates="listings")
    material_category = relationship("MaterialCategory", back_populates="listings")
    brand = relationship("Brand", back_populates="listings")
    pickups = relationship("Pickup", back_populates="listing", cascade="all, delete-orphan")


class Pickup(Base):
    __tablename__ = "pickups"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    listing_id = Column(String(36), ForeignKey("listings.id"), nullable=False, index=True)
    collector_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    status = Column(_db_enum(PickupStatus), nullable=False, default=PickupStatus.offered, index=True)
    offered_price_naira = Column(Numeric(12, 2), nullable=True)
    distance_m = Column(Float, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    estimated_arrival_min = Column(Integer, nullable=True)
    sms_message_id = Column(String(64), nullable=True)
    ussd_session_id = Column(String(64), nullable=True)
    ivr_call_sid = Column(String(64), nullable=True)
    reject_reason = Column(String(255), nullable=True)
    # ── Proof-of-handover (verified data) ──────────────────────────
    # The collector gets a PIN at accept time and reads it to the seller, who
    # enters it to confirm the handover. Only the hash is stored. An unresolved
    # handover holds new leads (collector) and new listings (seller).
    pin_hash = Column(String(128), nullable=True)
    pin_attempts = Column(Integer, nullable=False, default=0, server_default="0")
    pin_expires_at = Column(DateTime, nullable=True)
    confirm_deadline = Column(DateTime, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    disputed_at = Column(DateTime, nullable=True)
    dispute_reason = Column(String(255), nullable=True)
    # What the collector recorded at handover, replayed when the seller confirms.
    handover_weight_kg = Column(Numeric(10, 3), nullable=True)
    handover_unit_price_naira = Column(Numeric(12, 2), nullable=True)
    handover_payment_method = Column(String(20), nullable=True)
    handover_hub_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    listing = relationship("Listing", back_populates="pickups")
    collector = relationship("User", foreign_keys=[collector_id], back_populates="pickups")
    transaction = relationship("Transaction", back_populates="pickup", uselist=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    pickup_id = Column(String(36), ForeignKey("pickups.id"), nullable=False, unique=True, index=True)
    seller_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    collector_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    material_category_id = Column(
        Integer, ForeignKey("material_categories.id"), nullable=False, index=True
    )
    brand_id = Column(String(36), ForeignKey("brands.id"), nullable=True, index=True)
    gtin = Column(String(64), nullable=True, index=True)
    weight_kg = Column(Numeric(10, 3), nullable=False)
    unit_price_naira = Column(Numeric(12, 2), nullable=False)
    gross_value_naira = Column(Numeric(12, 2), nullable=False)
    platform_fee_naira = Column(Numeric(12, 2), nullable=False, default=0)
    collector_earnings_naira = Column(Numeric(12, 2), nullable=False, default=0)
    seller_payout_naira = Column(Numeric(12, 2), nullable=False, default=0)
    payment_method = Column(_db_enum(PaymentMethod), nullable=True)
    payment_reference = Column(String(120), nullable=True)
    status = Column(_db_enum(TransactionStatus), nullable=False, default=TransactionStatus.pending, index=True)
    settled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    pickup = relationship("Pickup", back_populates="transaction")
    seller = relationship("User", foreign_keys=[seller_id], back_populates="sold_transactions")
    collector = relationship("User", foreign_keys=[collector_id], back_populates="collected_transactions")
    impact_log = relationship("NGOImpactLog", back_populates="transaction", uselist=False)
    brand = relationship("Brand", back_populates="transactions")


class NGOImpactLog(Base):
    __tablename__ = "ngo_impact_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(36), ForeignKey("transactions.id"), nullable=False, unique=True, index=True)
    material_category_id = Column(
        Integer, ForeignKey("material_categories.id"), nullable=False, index=True
    )
    tonnage_kg = Column(Numeric(14, 3), nullable=False)
    carbon_offset_kg_co2e = Column(Numeric(14, 4), nullable=False, default=0)
    collector_income_naira = Column(Numeric(12, 2), nullable=False, default=0)
    hub = Column(String(64), nullable=False, default="Zaria")
    period = Column(Date, nullable=False, index=True)
    raw_metrics = Column(JSON, nullable=True)
    carbon_kg_co2e_per_kg_used = Column(Numeric(10, 4), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    transaction = relationship("Transaction", back_populates="impact_log")
    material_category = relationship("MaterialCategory")


class SyncOutbox(Base):
    __tablename__ = "sync_outbox"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    aggregate_type = Column(String(40), nullable=False)
    aggregate_id = Column(String(36), nullable=False)
    event_type = Column(String(40), nullable=False)
    payload = Column(JSON, nullable=False)
    attempt_count = Column(Integer, nullable=False, default=0)
    next_retry_at = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    max_attempts = Column(Integer, nullable=False, default=5)
    sent_at = Column(DateTime, nullable=True)
    provider_message_id = Column(String(120), nullable=True)
    error_code = Column(String(40), nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ScrapScan(Base):
    __tablename__ = "scrap_scans"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    material_class = Column(String, nullable=False)
    sub_grade = Column(String, nullable=True)
    weight_est_kg = Column(Float, nullable=True)
    estimated_naira_value = Column(Float, nullable=False)
    confidence_score = Column(Float, default=1.0)
    toxicity_hazards = Column(JSON, nullable=True)
    safety_instructions = Column(String, nullable=True)
    captured_at = Column(DateTime, nullable=False)
    synced_at = Column(DateTime, server_default=func.now())
    is_deleted = Column(Boolean, default=False)

    owner = relationship("User", back_populates="scans")


class PriceMatrix(Base):
    __tablename__ = "price_matrices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    material_class = Column(String, unique=True, index=True, nullable=False)
    price_per_kg_naira = Column(Float, nullable=False)
    last_updated = Column(DateTime, onupdate=func.now(), server_default=func.now())
    updated_by = Column(String, nullable=True)


class RecyclingHub(Base):
    __tablename__ = "recycling_hubs"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    owner_user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    address_text = Column(String(320), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String(80), nullable=False, default="Zaria")
    contact_phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    requests = relationship(
        "HubRecyclingRequest", back_populates="hub", cascade="all, delete-orphan"
    )


class HubSubscription(Base):
    __tablename__ = "hub_subscriptions"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    hub_id = Column(String(36), ForeignKey("recycling_hubs.id"), nullable=False, index=True)
    plan_name = Column(String(60), nullable=False, default="Pro")
    amount_naira = Column(Numeric(12, 2), nullable=False)
    cycle = Column(String(20), nullable=False, default="monthly")
    started_at = Column(DateTime, nullable=False, server_default=func.now())
    next_billing_at = Column(DateTime, nullable=True)
    status = Column(
        _db_enum(HubSubscriptionStatus),
        nullable=False,
        default=HubSubscriptionStatus.active,
        index=True,
    )
    payment_method = Column(_db_enum(PaymentMethod), nullable=True)
    payment_reference = Column(String(120), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    hub = relationship("RecyclingHub", backref="subscriptions")


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    plan = Column(_db_enum(SubscriptionPlan), nullable=False)
    amount_naira = Column(Numeric(12, 2), nullable=False)
    cycle = Column(String(20), nullable=False, default="quarterly")
    started_at = Column(DateTime, nullable=False, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)
    status = Column(
        _db_enum(SubscriptionStatus),
        nullable=False,
        default=SubscriptionStatus.active,
        index=True,
    )
    payment_method = Column(_db_enum(PaymentMethod), nullable=True)
    payment_reference = Column(String(120), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="subscriptions")


class HubRecyclingRequest(Base):
    __tablename__ = "hub_recycling_requests"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    hub_id = Column(String(36), ForeignKey("recycling_hubs.id"), nullable=False, index=True)
    material_category_id = Column(
        Integer, ForeignKey("material_categories.id"), nullable=False, index=True
    )
    requested_kg = Column(Numeric(12, 3), nullable=False)
    fulfilled_kg = Column(Numeric(12, 3), nullable=False, default=0)
    note = Column(String(320), nullable=True)
    requested_on = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="open", index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    hub = relationship("RecyclingHub", back_populates="requests", foreign_keys=[hub_id])
    material_category = relationship("MaterialCategory")
    deliveries = relationship("HubDelivery", back_populates="request")


class HubDelivery(Base):
    __tablename__ = "hub_deliveries"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    hub_id = Column(String(36), ForeignKey("recycling_hubs.id"), nullable=False, index=True)
    request_id = Column(
        String(36), ForeignKey("hub_recycling_requests.id"), nullable=True, index=True
    )
    transaction_id = Column(
        String(36), ForeignKey("transactions.id"), nullable=False, unique=True, index=True
    )
    material_category_id = Column(
        Integer, ForeignKey("material_categories.id"), nullable=False, index=True
    )
    weight_kg = Column(Numeric(12, 3), nullable=False)
    hub_price_naira = Column(Numeric(12, 2), nullable=False, default=0)
    delivered_at = Column(DateTime, nullable=False, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())

    hub = relationship("RecyclingHub")
    request = relationship("HubRecyclingRequest", back_populates="deliveries")
    transaction = relationship("Transaction")


class CompliancePartner(Base):
    __tablename__ = "compliance_partners"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    name = Column(String(160), nullable=False)
    partner_type = Column(String(40), nullable=False, default="pro")  # pro | recycler | fg
    api_key = Column(String(80), unique=True, nullable=False, index=True)
    api_keys_hash = Column(Text, nullable=True)  # hashed at rest support
    scopes = Column(JSON, nullable=True, default=list)
    last_used_at = Column(DateTime, nullable=True)
    brand_id = Column(String(36), ForeignKey("brands.id"), nullable=True, index=True)
    allow_category_aggregate = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    brand = relationship("Brand", back_populates="compliance_partners")


class Brand(Base):
    __tablename__ = "brands"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    name = Column(String(160), unique=True, nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    # Producer-owned product catalog: [{gtin, sku, product}] — only identifiers
    # listed here map to this brand (own-product attribution rule).
    catalog = Column(JSON, nullable=False, default=list)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    compliance_partners = relationship(
        "CompliancePartner", back_populates="brand"
    )
    listings = relationship("Listing", back_populates="brand")
    transactions = relationship("Transaction", back_populates="brand")


class PaymentTransaction(Base):
    """A mobile-money checkout attempt for a subscription.

    One row is created per checkout. ``reference_id`` is the ``X-Reference-Id``
    we send to MTN MoMo and is the idempotency key both for MoMo and for our own
    activation step: ``applied`` guards against activating (or extending) a
    subscription twice if a callback and a poll both report success.
    """

    __tablename__ = "payment_transactions"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    hub_id = Column(String(36), ForeignKey("recycling_hubs.id"), nullable=True, index=True)
    purpose = Column(_db_enum(PaymentPurpose), nullable=False, index=True)
    plan = Column(String(40), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(8), nullable=False, default="EUR")
    provider = Column(String(30), nullable=False, default="mtn_momo")
    # UUID handed to MoMo as X-Reference-Id; unique so retries can't duplicate.
    reference_id = Column(String(64), nullable=False, unique=True, index=True)
    external_id = Column(String(64), nullable=True)
    payer_msisdn = Column(String(20), nullable=False)
    status = Column(
        _db_enum(PaymentStatus), nullable=False, default=PaymentStatus.pending, index=True
    )
    provider_status = Column(String(30), nullable=True)
    provider_financial_tx_id = Column(String(120), nullable=True)
    failure_reason = Column(String(255), nullable=True)
    # True once the successful payment has been turned into a subscription.
    applied = Column(Boolean, nullable=False, default=False)
    raw_payload = Column(JSON, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User")
    hub = relationship("RecyclingHub")

