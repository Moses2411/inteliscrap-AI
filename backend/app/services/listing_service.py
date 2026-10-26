from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Listing, ListingStatus, MaterialCategory, User
from app.schemas import ListingCreate
from app.services import location_service, matching_service, pickup_service, subscription_service


def _resolve_listing_coords(
    seller: User, payload: ListingCreate
) -> tuple[float | None, float | None, str | None]:
    """Coordinates for a new listing, with an area fallback.

    A listing posted with a real GPS fix keeps it. When the seller has no fix
    (denied permission, feature-phone upload) we try to place the listing from
    the address they typed or their hub/area so nearby collectors can still be
    dispatched to it. The precision tells the offer UI to label it approximate.
    """
    if payload.latitude is not None and payload.longitude is not None:
        return payload.latitude, payload.longitude, location_service.PRECISION_GPS

    address = payload.address_text or seller.address_text
    resolved = location_service.resolve_fallback(seller.location_hub, address)
    if resolved is None:
        return payload.latitude, payload.longitude, None
    latitude, longitude, precision = resolved
    return latitude, longitude, precision


def _estimated_value(
    material: MaterialCategory | None,
    weight_kg: float | None,
    supplied: float | None,
) -> Decimal | None:
    """Total value, deriving it from the material's per-kg price when only a
    weight was given. Callers that send a value keep it."""
    if supplied is not None:
        return Decimal(str(supplied))
    if weight_kg is None or material is None or material.price_per_kg_naira is None:
        return None
    return Decimal(str(material.price_per_kg_naira)) * Decimal(str(weight_kg))


async def create_listing(db: AsyncSession, seller: User, payload: ListingCreate) -> Listing:
    # Compliance hold: a seller with an unresolved handover cannot post new
    # listings until every open pickup is confirmed complete.
    if await pickup_service.has_open_handover(db, seller_id=seller.id):
        raise ValueError(
            "You have an open handover to confirm before posting new listings"
        )

    # Check subscription limits
    allowed, error = await subscription_service.can_create_listing(db, seller)
    if not allowed:
        raise ValueError(error)

    latitude, longitude, location_precision = _resolve_listing_coords(seller, payload)

    material = await db.get(MaterialCategory, payload.material_category_id)

    listing = Listing(
        seller_id=seller.id,
        material_category_id=payload.material_category_id,
        title=payload.title,
        description=payload.description,
        photo_url=payload.photo_url,
        estimated_weight_kg=payload.estimated_weight_kg,
        estimated_value_naira=_estimated_value(
            material, payload.estimated_weight_kg, payload.estimated_value_naira
        ),
        confidence_score=payload.confidence_score,
        toxicity_hazards=payload.toxicity_hazards,
        latitude=latitude,
        longitude=longitude,
        location_precision=location_precision,
        address_text=payload.address_text,
        contact_phone=payload.contact_phone,
        status=ListingStatus.active,
        is_large_quantity=False,
        listing_fee_naira=0,
    )
    db.add(listing)
    await db.flush()

    # Increment listing count
    await subscription_service.increment_listing_count(db, seller)

    if payload.auto_dispatch and listing.latitude is not None and listing.longitude is not None:
        await matching_service.dispatch_listing(
            db,
            listing,
            material.name if material else None,
            settings.dispatch_radius_m,
            settings.dispatch_max_collectors,
        )

    await db.flush()
    return listing


async def get_listing(db: AsyncSession, listing_id: str) -> Listing | None:
    return await db.get(Listing, listing_id)


async def list_active(db: AsyncSession) -> list[Listing]:
    result = await db.execute(
        select(Listing)
        .where(
            Listing.status.in_(
                [ListingStatus.active, ListingStatus.matched]
            )
        )
        .order_by(Listing.created_at.desc())
    )
    return list(result.scalars().all())


async def get_user_listings(db: AsyncSession, user: User) -> list[Listing]:
    result = await db.execute(
        select(Listing)
        .where(Listing.seller_id == user.id)
        .order_by(Listing.created_at.desc())
    )
    return list(result.scalars().all())