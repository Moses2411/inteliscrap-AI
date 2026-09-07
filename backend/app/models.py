import enum
import uuid

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
    household = "household"
    collector = "collector"
    admin = "admin"
    ngo = "ngo"


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


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=True)
    role = Column(_db_enum(UserRole), nullable=False, default=UserRole.household, index=True)
    language_pref = Column(String(8), nullable=False, default="ha")
    location_hub = Column(String(64), default="Zaria")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    last_seen_at = Column(DateTime, nullable=True)
    device_id = Column(String(64), nullable=True)
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


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


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
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    listings = relationship("Listing", back_populates="material_category")


class Listing(Base):
    __tablename__ = "listings"

    id = Column(String(36), primary_key=True, index=True, default=_uuid)
    seller_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    material_category_id = Column(
        Integer, ForeignKey("material_categories.id"), nullable=False, index=True
    )
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
    status = Column(_db_enum(ListingStatus), nullable=False, default=ListingStatus.active, index=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    seller = relationship("User", foreign_keys=[seller_id], back_populates="listings")
    material_category = relationship("MaterialCategory", back_populates="listings")
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
    created_at = Column(DateTime, server_default=func.now())

    transaction = relationship("Transaction", back_populates="impact_log")


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
