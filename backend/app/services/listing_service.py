from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Listing, ListingStatus, MaterialCategory, User
from app.schemas import ListingCreate
from app.services import matching_service, subscription_service


async def create_listing(db: AsyncSession, seller: User, payload: ListingCreate) -> Listing:
    # Check subscription limits
    allowed, error = await subscription_service.can_create_listing(db, seller)
    if not allowed:
        raise ValueError(error)

    # Determine if this is a large quantity listing (for tracking, not blocking)
    is_large = False
    listing_fee = 0
    if payload.estimated_weight_kg and payload.estimated_weight_kg > 100:
        is_large = True

    listing = Listing(
        seller_id=seller.id,
        material_category_id=payload.material_category_id,
        title=payload.title,
        description=payload.description,
        photo_url=payload.photo_url,
        estimated_weight_kg=payload.estimated_weight_kg,
        estimated_value_naira=payload.estimated_value_naira,
        confidence_score=payload.confidence_score,
        toxicity_hazards=payload.toxicity_hazards,
        latitude=payload.latitude,
        longitude=payload.longitude,
        address_text=payload.address_text,
        contact_phone=payload.contact_phone,
        status=ListingStatus.active,
        is_large_quantity=is_large,
        listing_fee_naira=listing_fee,
    )
    db.add(listing)
    await db.flush()

    # Increment listing count
    await subscription_service.increment_listing_count(db, seller)

    if payload.auto_dispatch and listing.latitude is not None and listing.longitude is not None:
        material = await db.get(MaterialCategory, payload.material_category_id)
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