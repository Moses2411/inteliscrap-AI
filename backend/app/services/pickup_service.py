from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core import security
from app.models import (
    Listing,
    ListingStatus,
    MaterialCategory,
    PaymentMethod,
    Pickup,
    PickupStatus,
    SyncOutbox,
    Transaction,
    User,
)
from app.services import messaging_service
from app.services.matching_service import haversine_m

# Field-work states occupy one of the collector's concurrent pickup slots.
# A collector may work several of these at once (see
# ``settings.collector_max_active_jobs``).
ACTIVE_JOB_STATUSES = (
    PickupStatus.accepted,
    PickupStatus.en_route,
    PickupStatus.arrived,
    PickupStatus.verified,
)

# Any unresolved handover holds the seller's new listings. ``pending_confirmation``
# and ``disputed`` are included here even though they free the collector's slot:
# the seller cannot publish again until the handover is settled.
HOLD_STATUSES = ACTIVE_JOB_STATUSES + (
    PickupStatus.pending_confirmation,
    PickupStatus.disputed,
)


class CollectorAtCapacity(ValueError):
    """Raised when a collector already works the maximum number of jobs."""

    def __init__(self, capacity: "CollectorCapacity"):
        self.capacity = capacity
        super().__init__(
            f"You already have {capacity.active_jobs} active pickups "
            f"(limit {capacity.max_jobs}). Finish one before accepting another."
        )


@dataclass(frozen=True)
class CollectorCapacity:
    active_jobs: int
    max_jobs: int

    @property
    def remaining_slots(self) -> int:
        return max(0, self.max_jobs - self.active_jobs)

    @property
    def at_capacity(self) -> bool:
        return self.remaining_slots == 0


def max_active_jobs() -> int:
    return max(1, settings.collector_max_active_jobs)


async def count_active_jobs(
    db: AsyncSession, collector_id: str, *, exclude_pickup_id: str | None = None
) -> int:
    stmt = select(func.count(Pickup.id)).where(
        Pickup.collector_id == collector_id,
        Pickup.status.in_(ACTIVE_JOB_STATUSES),
    )
    if exclude_pickup_id is not None:
        stmt = stmt.where(Pickup.id != exclude_pickup_id)
    return int(await db.scalar(stmt) or 0)


async def count_open_handovers(db: AsyncSession, collector_id: str) -> int:
    count = await db.scalar(
        select(func.count(Pickup.id)).where(
            Pickup.collector_id == collector_id,
            Pickup.status.in_(HOLD_STATUSES),
        )
    )
    return int(count or 0)


async def collector_capacity(
    db: AsyncSession,
    collector_id: str,
    *,
    lock: bool = False,
    exclude_pickup_id: str | None = None,
) -> CollectorCapacity:
    """How many concurrent pickup slots the collector is using.

    ``lock=True`` serialises concurrent accepts for the same collector on
    databases that support row locks (Postgres), so two tabs cannot both take
    the last slot. SQLite ignores the clause, but writes are serialised anyway.
    """
    if lock:
        await db.execute(
            select(User.id).where(User.id == collector_id).with_for_update()
        )
    active = await count_active_jobs(
        db, collector_id, exclude_pickup_id=exclude_pickup_id
    )
    return CollectorCapacity(active_jobs=active, max_jobs=max_active_jobs())


async def get_pending_offers(
    db: AsyncSession, collector: User
) -> list[tuple[Pickup, Listing, MaterialCategory]]:
    result = await db.execute(
        select(Pickup, Listing, MaterialCategory)
        .join(Listing, Pickup.listing_id == Listing.id)
        .join(MaterialCategory, Listing.material_category_id == MaterialCategory.id)
        .where(
            Pickup.collector_id == collector.id,
            Pickup.status == PickupStatus.offered,
            Listing.status.in_([ListingStatus.active, ListingStatus.matched]),
        )
        .order_by(Pickup.distance_m.asc())
    )
    return list(result.all())


async def get_active_pickups(
    db: AsyncSession, collector: User
) -> list[tuple[Pickup, Listing, MaterialCategory]]:
    result = await db.execute(
        select(Pickup, Listing, MaterialCategory)
        .join(Listing, Pickup.listing_id == Listing.id)
        .join(MaterialCategory, Listing.material_category_id == MaterialCategory.id)
        .where(
            Pickup.collector_id == collector.id,
            Pickup.status.in_(HOLD_STATUSES),
        )
        .order_by(Pickup.accepted_at.desc())
    )
    return list(result.all())


async def get_awaiting_confirmation(
    db: AsyncSession, seller: User
) -> list[tuple[Pickup, Listing, MaterialCategory]]:
    """Open handovers on the seller's own listings (the ones that hold them)."""
    result = await db.execute(
        select(Pickup, Listing, MaterialCategory)
        .join(Listing, Pickup.listing_id == Listing.id)
        .join(MaterialCategory, Listing.material_category_id == MaterialCategory.id)
        .where(
            Listing.seller_id == seller.id,
            Pickup.status.in_(HOLD_STATUSES),
        )
        .order_by(Pickup.accepted_at.desc())
    )
    return list(result.all())


async def has_open_handover(
    db: AsyncSession,
    *,
    collector_id: str | None = None,
    seller_id: str | None = None,
) -> bool:
    stmt = select(Pickup.id).where(Pickup.status.in_(HOLD_STATUSES))
    if collector_id is not None:
        stmt = stmt.where(Pickup.collector_id == collector_id)
    if seller_id is not None:
        stmt = stmt.join(Listing, Pickup.listing_id == Listing.id).where(
            Listing.seller_id == seller_id
        )
    stmt = stmt.limit(1)
    return (await db.execute(stmt)).first() is not None


async def escalate_overdue_handovers(db: AsyncSession) -> int:
    """Move unconfirmed handovers past their deadline to ``disputed``."""
    now = datetime.utcnow()
    result = await db.execute(
        update(Pickup)
        .where(
            Pickup.status.in_(HOLD_STATUSES),
            Pickup.confirm_deadline.is_not(None),
            Pickup.confirm_deadline < now,
        )
        .values(
            status=PickupStatus.disputed,
            disputed_at=now,
            dispute_reason="Confirmation window elapsed",
        )
    )
    await db.flush()
    return result.rowcount or 0


def issue_handover_pin(pickup: Pickup) -> str:
    """Mint a fresh confirmation code for the seller.

    The hash gates verification; the plaintext is cached so the seller can
    re-read the code on their dashboard and read it out to the collector.
    """
    pin = security.generate_pin()
    pickup.pin_hash = security.hash_pin(pin)
    pickup.pin_cache = pin
    pickup.pin_attempts = 0
    pickup.pin_expires_at = datetime.utcnow() + timedelta(
        hours=settings.handover_pin_ttl_hours
    )
    return pin


async def accept_pickup(db: AsyncSession, pickup: Pickup, listing: Listing) -> str:
    """Mark the pickup accepted and return the plaintext handover PIN."""
    capacity = await collector_capacity(
        db,
        pickup.collector_id,
        lock=True,
        exclude_pickup_id=pickup.id,
    )
    if capacity.at_capacity:
        raise CollectorAtCapacity(capacity)

    now = datetime.utcnow()
    pickup.status = PickupStatus.accepted
    pickup.accepted_at = now
    pickup.confirm_deadline = now + timedelta(
        hours=settings.handover_confirm_window_hours
    )
    listing.status = ListingStatus.scheduled

    await db.execute(
        Pickup.__table__.update()
        .where(
            Pickup.listing_id == listing.id,
            Pickup.status == PickupStatus.offered,
        )
        .values(status=PickupStatus.expired)
    )
    pin = issue_handover_pin(pickup)
    await db.flush()
    return pin


async def claim_listing(
    db: AsyncSession, listing: Listing, collector: User
) -> tuple[Pickup, str] | None:
    """Collector claims a listing directly from the market board.

    Returns the created pickup and its handover PIN, or ``None`` when the
    listing can no longer be claimed (already scheduled, completed or taken).
    """
    if listing.status not in (ListingStatus.active, ListingStatus.matched):
        return None

    # Check before creating the pickup row, so an at-capacity collector leaves
    # no partial claim behind in the session.
    capacity = await collector_capacity(db, collector.id, lock=True)
    if capacity.at_capacity:
        raise CollectorAtCapacity(capacity)

    taken = await db.execute(
        select(Pickup.id)
        .where(
            Pickup.listing_id == listing.id,
            Pickup.status.in_(
                [
                    PickupStatus.accepted,
                    PickupStatus.en_route,
                    PickupStatus.arrived,
                    PickupStatus.verified,
                    PickupStatus.pending_confirmation,
                    PickupStatus.disputed,
                    PickupStatus.completed,
                ]
            ),
        )
        .limit(1)
    )
    if taken.first() is not None:
        return None

    distance_m = None
    if (
        listing.latitude is not None
        and listing.longitude is not None
        and collector.latitude is not None
        and collector.longitude is not None
    ):
        distance_m = haversine_m(
            listing.latitude, listing.longitude, collector.latitude, collector.longitude
        )

    pickup = Pickup(
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
        accepted_at=datetime.utcnow(),
        distance_m=distance_m,
    )
    db.add(pickup)
    await db.flush()
    # Mark accepted, move the listing to "scheduled" and expire rival offers.
    pin = await accept_pickup(db, pickup, listing)
    return pickup, pin


async def record_handover(
    db: AsyncSession,
    pickup: Pickup,
    weight_kg: float,
    unit_price_naira: float | None = None,
    payment_method: PaymentMethod | None = None,
    hub_id: str | None = None,
) -> None:
    """Collector records what was collected; the seller then shares the code."""
    pickup.handover_weight_kg = weight_kg
    pickup.handover_unit_price_naira = unit_price_naira
    pickup.handover_payment_method = (
        payment_method.value if payment_method is not None else None
    )
    pickup.handover_hub_id = hub_id
    pickup.status = PickupStatus.pending_confirmation
    await db.flush()


async def confirm_handover(db: AsyncSession, pickup: Pickup, pin: str) -> Transaction:
    """The collector enters the seller's code → settles the pickup."""
    from app.services import settlement_service  # local import avoids a cycle

    now = datetime.utcnow()
    if pickup.status not in (PickupStatus.pending_confirmation, PickupStatus.disputed):
        raise ValueError("This handover is not awaiting confirmation")
    if pickup.pin_expires_at is not None and pickup.pin_expires_at < now:
        raise ValueError("This confirmation code has expired")
    if (pickup.pin_attempts or 0) >= settings.handover_pin_max_attempts:
        raise ValueError("Too many incorrect attempts — contact support")

    if not security.verify_pin(pin, pickup.pin_hash):
        pickup.pin_attempts = (pickup.pin_attempts or 0) + 1
        await db.flush()
        remaining = settings.handover_pin_max_attempts - pickup.pin_attempts
        raise ValueError(
            f"Incorrect confirmation code ({max(remaining, 0)} attempts left)"
        )

    if pickup.handover_weight_kg is None:
        raise ValueError("No handover weight recorded — ask the collector to record it")

    payment_method = (
        PaymentMethod(pickup.handover_payment_method)
        if pickup.handover_payment_method
        else PaymentMethod.cash
    )
    transaction = await settlement_service.settle_pickup(
        db,
        pickup,
        weight_kg=pickup.handover_weight_kg,
        unit_price_naira=pickup.handover_unit_price_naira,
        payment_method=payment_method,
        hub_id=pickup.handover_hub_id,
    )
    pickup.confirmed_at = now
    await db.flush()
    return transaction


async def resolve_dispute(
    db: AsyncSession, pickup: Pickup, resolution: str, reason: str | None = None
) -> Transaction | None:
    """Admin resolution for a disputed handover: ``confirm`` or ``cancel``."""
    from app.services import settlement_service  # local import avoids a cycle

    await db.refresh(pickup)
    if pickup.status != PickupStatus.disputed:
        raise ValueError("Pickup is not disputed")

    if reason:
        pickup.dispute_reason = f"{pickup.dispute_reason or ''} | {reason}".strip(" |")

    if resolution == "confirm":
        if pickup.handover_weight_kg is None:
            raise ValueError("No handover weight recorded — cannot force-confirm")
        payment_method = (
            PaymentMethod(pickup.handover_payment_method)
            if pickup.handover_payment_method
            else PaymentMethod.cash
        )
        transaction = await settlement_service.settle_pickup(
            db,
            pickup,
            weight_kg=pickup.handover_weight_kg,
            unit_price_naira=pickup.handover_unit_price_naira,
            payment_method=payment_method,
            hub_id=pickup.handover_hub_id,
        )
        pickup.confirmed_at = datetime.utcnow()
        await db.flush()
        return transaction

    # cancel: close the pickup and its listing so both parties are released.
    pickup.status = PickupStatus.cancelled
    listing = await db.get(Listing, pickup.listing_id)
    if listing is not None and listing.status in (
        ListingStatus.active,
        ListingStatus.matched,
        ListingStatus.scheduled,
    ):
        listing.status = ListingStatus.cancelled
    await db.flush()
    return None


async def enqueue_location_sms(
    db: AsyncSession,
    collector: User,
    pickup: Pickup,
    listing: Listing,
    pin: str | None = None,
) -> None:
    """On accept: text the collector the job details, text the seller the code.

    The collector gets location + the seller's phone (no code — the seller
    reads that out at handover). The seller gets the confirmation code to
    share with the collector.
    """
    message = (
        f"InteliScrap: {listing.title or 'Kaya'} - "
        f"{listing.address_text or 'A duba wuri da ko'}. "
        f"Lati {listing.latitude}, Longi {listing.longitude}."
    )
    if listing.contact_phone:
        message += f" Lambar mai sayarwa: {listing.contact_phone}."
    try:
        result = await messaging_service.send_sms(collector.phone_number, message)
        recipients = result.get("SMSMessageData", {}).get("Recipients") or []
        pickup.sms_message_id = recipients[0].get("messageId", "") if recipients else ""
    except Exception:
        db.add(
            SyncOutbox(
                aggregate_type="pickup",
                aggregate_id=pickup.id,
                event_type="sms.location",
                payload={"phone_number": collector.phone_number, "message": message},
                status="pending",
            )
        )

    if pin:
        seller = await db.get(User, listing.seller_id)
        if seller is not None:
            seller_message = (
                f"InteliScrap: An collector ya karbi kayanka. "
                f"Lambar tabbatarwa: {pin}."
                f" Karanta wa mai tara lokacin da ya iso."
            )
            try:
                await messaging_service.send_sms(seller.phone_number, seller_message)
            except Exception:
                db.add(
                    SyncOutbox(
                        aggregate_type="pickup",
                        aggregate_id=pickup.id,
                        event_type="sms.handover_pin",
                        payload={"phone_number": seller.phone_number, "message": seller_message},
                        status="pending",
                    )
                )
    await db.flush()
