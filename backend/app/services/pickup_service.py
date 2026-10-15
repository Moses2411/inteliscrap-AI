from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Listing,
    ListingStatus,
    MaterialCategory,
    Pickup,
    PickupStatus,
    SyncOutbox,
    User,
)
from app.services import messaging_service
from app.services.matching_service import haversine_m


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
            Pickup.status.in_(
                [
                    PickupStatus.accepted,
                    PickupStatus.en_route,
                    PickupStatus.arrived,
                    PickupStatus.verified,
                ]
            ),
        )
        .order_by(Pickup.accepted_at.desc())
    )
    return list(result.all())


async def accept_pickup(db: AsyncSession, pickup: Pickup, listing: Listing) -> None:
    pickup.status = PickupStatus.accepted
    pickup.accepted_at = datetime.utcnow()
    listing.status = ListingStatus.scheduled

    await db.execute(
        Pickup.__table__.update()
        .where(
            Pickup.listing_id == listing.id,
            Pickup.status == PickupStatus.offered,
        )
        .values(status=PickupStatus.expired)
    )
    await db.flush()


async def claim_listing(
    db: AsyncSession, listing: Listing, collector: User
) -> Pickup | None:
    """Collector claims a listing directly from the market board.

    Returns the created pickup, or ``None`` when the listing can no longer be
    claimed (already scheduled, completed or already taken by someone else).
    """
    if listing.status not in (ListingStatus.active, ListingStatus.matched):
        return None

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
    await accept_pickup(db, pickup, listing)
    return pickup


async def enqueue_location_sms(
    db: AsyncSession, collector: User, pickup: Pickup, listing: Listing
) -> None:
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
    await db.flush()
