from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Listing, ListingStatus, User
from app.schemas import ListingCreate
from app.services import matching_service


async def create_listing(db: AsyncSession, seller: User, payload: ListingCreate) -> Listing:
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
        status=ListingStatus.active,
    )
    db.add(listing)
    await db.flush()

    if payload.auto_dispatch and listing.latitude is not None and listing.longitude is not None:
        await matching_service.dispatch_listing(
            db, listing, settings.dispatch_radius_m, settings.dispatch_max_collectors
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
                [ListingStatus.active, ListingStatus.matched, ListingStatus.scheduled]
            )
        )
        .order_by(Listing.created_at.desc())
    )
    return list(result.scalars().all())
