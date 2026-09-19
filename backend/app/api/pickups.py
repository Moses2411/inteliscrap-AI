from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.database import get_db
from app.models import Listing, MaterialCategory, Pickup, PickupStatus, User, UserRole
from app.schemas import PickupJobResponse, PickupOfferResponse
from app.services import pickup_service

router = APIRouter(prefix="/api/v1/pickups", tags=["pickups"])


def _offer_response(
    pickup: Pickup, listing: Listing, material: MaterialCategory
) -> PickupOfferResponse:
    return PickupOfferResponse(
        pickup_id=pickup.id,
        listing_id=listing.id,
        material_name=material.name,
        material_slug=material.slug,
        estimated_weight_kg=_to_float(listing.estimated_weight_kg),
        estimated_value_naira=_to_float(listing.estimated_value_naira),
        toxicity_hazards=listing.toxicity_hazards,
        address_text=listing.address_text,
        distance_m=pickup.distance_m,
        created_at=listing.created_at,
    )


def _job_response(
    pickup: Pickup, listing: Listing, material: MaterialCategory
) -> PickupJobResponse:
    return PickupJobResponse(
        pickup_id=pickup.id,
        listing_id=listing.id,
        material_name=material.name,
        material_slug=material.slug,
        estimated_weight_kg=_to_float(listing.estimated_weight_kg),
        estimated_value_naira=_to_float(listing.estimated_value_naira),
        toxicity_hazards=listing.toxicity_hazards,
        address_text=listing.address_text,
        distance_m=pickup.distance_m,
        created_at=listing.created_at,
        status=pickup.status.value,
        contact_phone=listing.contact_phone,
        latitude=listing.latitude,
        longitude=listing.longitude,
        scheduled_at=pickup.scheduled_at,
        accepted_at=pickup.accepted_at,
    )


def _to_float(value) -> float | None:
    return float(value) if value is not None else None


@router.get("/offers", response_model=list[PickupOfferResponse])
async def list_offers(
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    rows = await pickup_service.get_pending_offers(db, collector)
    return [_offer_response(pickup, listing, material) for pickup, listing, material in rows]


@router.post("/{pickup_id}/accept", response_model=PickupJobResponse)
async def accept_offer(
    pickup_id: str,
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    pickup = await db.get(Pickup, pickup_id)
    if pickup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup not found")
    if pickup.collector_id != collector.id or pickup.status != PickupStatus.offered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Offer is no longer available",
        )

    listing = await db.get(Listing, pickup.listing_id)
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    material = await db.get(MaterialCategory, listing.material_category_id)

    await pickup_service.accept_pickup(db, pickup, listing)
    await pickup_service.enqueue_location_sms(db, collector, pickup, listing)
    await db.flush()
    return _job_response(pickup, listing, material)


@router.get("/active", response_model=list[PickupJobResponse])
async def list_active(
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    rows = await pickup_service.get_active_pickups(db, collector)
    return [_job_response(pickup, listing, material) for pickup, listing, material in rows]
