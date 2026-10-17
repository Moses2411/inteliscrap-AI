from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
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
    UserRole,
)
from app.services import hub_service

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
    hub_id: str | None = None,
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

    # ── Hub delivery traceability ──────────────────────────────────
    # Collector may deliver directly to a registered recycling hub
    # (explicit hub_id), otherwise we fall back to the seller's hub.
    if hub_id is not None:
        hub = await hub_service.get_hub_by_id(db, hub_id)
        if hub is None or not hub.is_active:
            raise ValueError("Recycling hub not found or inactive")
    else:
        hub = await hub_service.get_hub_by_name(db, hub) if hub else None

    if hub is not None:
        open_reqs = await hub_service.get_open_requests_for_hub_material(
            db, hub.id, material.id
        )
        if open_reqs:
            for req in open_reqs:
                await hub_service.record_delivery(
                    db, hub, req, transaction, float(weight), float(gross)
                )
        else:
            await hub_service.record_unmatched_delivery(
                db, hub, transaction, material.id, float(weight), float(gross)
            )

    listing.actual_weight_kg = _q(weight, WEIGHT)
    listing.final_value_naira = gross
    listing.status = ListingStatus.completed
    pickup.status = PickupStatus.completed

    await db.flush()
    return transaction


# Pickups still in flight — jobs a collector has in hand but not yet settled.
IN_PROGRESS_PICKUP_STATUSES = (
    PickupStatus.accepted,
    PickupStatus.en_route,
    PickupStatus.arrived,
    PickupStatus.pending_confirmation,
)


async def _in_progress_value(db: AsyncSession, user: User) -> float:
    """Estimated naira value of work not yet settled (active jobs / listings).

    Mirrors the collector's "Jobs value" card: the listing's estimated value, or
    weight × current material price when no estimate was stored.
    """
    expr = func.coalesce(
        Listing.estimated_value_naira,
        Listing.estimated_weight_kg * MaterialCategory.price_per_kg_naira,
    )
    if user.role == UserRole.collector:
        stmt = (
            select(func.coalesce(func.sum(expr), 0))
            .select_from(Pickup)
            .join(Listing, Pickup.listing_id == Listing.id)
            .join(MaterialCategory, Listing.material_category_id == MaterialCategory.id)
            .where(
                Pickup.collector_id == user.id,
                Pickup.status.in_(IN_PROGRESS_PICKUP_STATUSES),
            )
        )
    elif user.role == UserRole.seller:
        stmt = (
            select(func.coalesce(func.sum(expr), 0))
            .select_from(Listing)
            .join(MaterialCategory, Listing.material_category_id == MaterialCategory.id)
            .where(
                Listing.seller_id == user.id,
                Listing.status.in_([ListingStatus.active, ListingStatus.matched]),
            )
        )
    else:
        return 0.0
    return float((await db.execute(stmt)).scalar() or 0)


async def get_user_earnings(db: AsyncSession, user: User) -> dict:
    """The caller's own income: settled (real) plus in-progress (estimated).

    Collectors earn ``collector_earnings_naira`` (gross less the platform fee);
    sellers receive ``seller_payout_naira``. Both update the moment a handover is
    confirmed (``confirm_handover`` → ``settle_pickup``).
    """
    if user.role == UserRole.collector:
        income_col = Transaction.collector_earnings_naira
        scope = Transaction.collector_id == user.id
    elif user.role == UserRole.seller:
        income_col = Transaction.seller_payout_naira
        scope = Transaction.seller_id == user.id
    else:
        return {
            "role": user.role.value,
            "total_income_naira": 0.0,
            "last_30_days_naira": 0.0,
            "settled_transactions": 0,
            "total_weight_kg": 0.0,
            "in_progress_value_naira": 0.0,
            "estimated_income_naira": 0.0,
        }

    settled = Transaction.status == TransactionStatus.settled

    total, count, weight = (
        await db.execute(
            select(
                func.coalesce(func.sum(income_col), 0),
                func.count(Transaction.id),
                func.coalesce(func.sum(Transaction.weight_kg), 0),
            ).where(scope, settled)
        )
    ).one()

    since = datetime.utcnow() - timedelta(days=30)
    recent = (
        await db.execute(
            select(func.coalesce(func.sum(income_col), 0)).where(
                scope, settled, Transaction.settled_at >= since
            )
        )
    ).scalar() or 0

    in_progress = await _in_progress_value(db, user)

    return {
        "role": user.role.value,
        "total_income_naira": float(total),
        "last_30_days_naira": float(recent),
        "settled_transactions": int(count),
        "total_weight_kg": float(weight),
        "in_progress_value_naira": in_progress,
        "estimated_income_naira": float(total) + in_progress,
    }
