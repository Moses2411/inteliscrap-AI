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


async def get_pending_offers(
    db: AsyncSession, collector: User
) -> list[tuple[Pickup, Listing, MaterialCategory]]:
    result = await db.execute(
        select(Pickup, Listing, MaterialCategory)
        .join(Listing, Pickup.listing_id == Listing.id)
        .join(MaterialCategory, Listing.material_category_id == MaterialCategory.id)
        .where(Pickup.collector_id == collector.id, Pickup.status == PickupStatus.offered)
        .order_by(Pickup.distance_m.asc())
    )
    return list(result.all())


async def accept_pickup(db: AsyncSession, pickup: Pickup, listing: Listing) -> None:
    pickup.status = PickupStatus.accepted
    pickup.accepted_at = datetime.utcnow()
    listing.status = ListingStatus.scheduled
    await db.flush()


async def enqueue_location_sms(
    db: AsyncSession, collector: User, pickup: Pickup, listing: Listing
) -> None:
    message = (
        f"InteliScrap: {listing.title or 'Kaya'} - "
        f"{listing.address_text or 'Wuri ba tare da adireshi'}. "
        f"Lati {listing.latitude}, Longi {listing.longitude}."
    )
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
