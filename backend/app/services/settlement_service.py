from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    Listing,
    ListingStatus,
    MaterialCategory,
    NGOImpactLog,
    PaymentMethod,
    Pickup,
    PickupStatus,
    Transaction,
    TransactionStatus,
    User,
)

MONEY = Decimal("0.01")
WEIGHT = Decimal("0.001")
CARBON = Decimal("0.0001")


def _q(value: Decimal, quantum: Decimal) -> Decimal:
    return value.quantize(quantum, rounding=ROUND_HALF_UP)


async def settle_pickup(
    db: AsyncSession,
    pickup: Pickup,
    weight_kg: float | Decimal,
    unit_price_naira: float | Decimal | None = None,
    payment_method: PaymentMethod = PaymentMethod.cash,
) -> Transaction:
    if pickup.collector_id is None:
        raise ValueError("Pickup has no assigned collector")

    weight = Decimal(str(weight_kg))
    if weight <= 0:
        raise ValueError("Weight must be positive")

    listing = await db.get(Listing, pickup.listing_id)
    if listing is None:
        raise ValueError("Listing not found")

    material = await db.get(MaterialCategory, listing.material_category_id)
    if material is None:
        raise ValueError("Material category not found")

    if unit_price_naira is None:
        unit_price = Decimal(str(material.price_per_kg_naira))
    else:
        unit_price = Decimal(str(unit_price_naira))

    gross = _q(weight * unit_price, MONEY)
    fee = _q(gross * Decimal(str(settings.platform_fee_rate)), MONEY)
    earnings = _q(gross - fee, MONEY)

    transaction = Transaction(
        pickup_id=pickup.id,
        seller_id=listing.seller_id,
        collector_id=pickup.collector_id,
        material_category_id=listing.material_category_id,
        weight_kg=_q(weight, WEIGHT),
        unit_price_naira=_q(unit_price, MONEY),
        gross_value_naira=gross,
        platform_fee_naira=fee,
        collector_earnings_naira=earnings,
        seller_payout_naira=gross,
        payment_method=payment_method,
        status=TransactionStatus.settled,
        settled_at=datetime.utcnow(),
    )
    db.add(transaction)
    await db.flush()

    carbon_per_kg = Decimal(str(material.carbon_kg_co2e_per_kg or 0))
    carbon_offset = _q(weight * carbon_per_kg, CARBON)

    seller = await db.get(User, listing.seller_id)
    hub = seller.location_hub if seller and seller.location_hub else "Zaria"

    impact = NGOImpactLog(
        transaction_id=transaction.id,
        material_category_id=material.id,
        tonnage_kg=_q(weight, WEIGHT),
        carbon_offset_kg_co2e=carbon_offset,
        collector_income_naira=earnings,
        hub=hub,
        period=datetime.utcnow().date(),
    )
    db.add(impact)

    listing.actual_weight_kg = _q(weight, WEIGHT)
    listing.final_value_naira = gross
    listing.status = ListingStatus.completed
    pickup.status = PickupStatus.completed

    await db.flush()
    return transaction
