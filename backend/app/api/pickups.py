from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models import (
    Listing,
    MaterialCategory,
    Pickup,
    PickupStatus,
    User,
    UserRole,
)
from app.schemas import (
    HandoverConfirmRequest,
    HandoverRequest,
    HoldStatusResponse,
    PickupAcceptResponse,
    PickupJobResponse,
    PickupOfferResponse,
    TransactionResponse,
)
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
        latitude=listing.latitude,
        longitude=listing.longitude,
        contact_phone=listing.contact_phone,
        contact_shared=listing.contact_phone is not None,
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
        contact_shared=listing.contact_phone is not None,
        latitude=listing.latitude,
        longitude=listing.longitude,
        scheduled_at=pickup.scheduled_at,
        accepted_at=pickup.accepted_at,
        confirm_deadline=pickup.confirm_deadline,
        confirmed_at=pickup.confirmed_at,
        disputed_at=pickup.disputed_at,
        dispute_reason=pickup.dispute_reason,
        handover_weight_kg=_to_float(pickup.handover_weight_kg),
        awaiting_confirmation=pickup.status
        in (PickupStatus.pending_confirmation, PickupStatus.disputed),
    )


def _to_float(value) -> float | None:
    return float(value) if value is not None else None


async def _load(db: AsyncSession, pickup_id: str) -> tuple[Pickup, Listing, MaterialCategory]:
    pickup = await db.get(Pickup, pickup_id)
    if pickup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup not found")
    listing = await db.get(Listing, pickup.listing_id)
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    material = await db.get(MaterialCategory, listing.material_category_id)
    if material is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Material category not found"
        )
    return pickup, listing, material


@router.get("/offers", response_model=list[PickupOfferResponse])
async def list_offers(
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    await pickup_service.escalate_overdue_handovers(db)
    # No new leads while a handover is still unresolved.
    if await pickup_service.has_open_handover(db, collector_id=collector.id):
        return []
    rows = await pickup_service.get_pending_offers(db, collector)
    return [_offer_response(pickup, listing, material) for pickup, listing, material in rows]


@router.get("/hold", response_model=HoldStatusResponse)
async def hold_status(
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    """Whether the collector is currently barred from new leads."""
    await pickup_service.escalate_overdue_handovers(db)
    count = await db.scalar(
        select(func.count(Pickup.id)).where(
            Pickup.collector_id == collector.id,
            Pickup.status.in_(pickup_service.HOLD_STATUSES),
        )
    )
    count = int(count or 0)
    return HoldStatusResponse(on_hold=count > 0, open_handovers=count)


@router.get("/active", response_model=list[PickupJobResponse])
async def list_active(
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    await pickup_service.escalate_overdue_handovers(db)
    rows = await pickup_service.get_active_pickups(db, collector)
    return [_job_response(pickup, listing, material) for pickup, listing, material in rows]


@router.get("/awaiting-confirmation", response_model=list[PickupJobResponse])
async def list_awaiting_confirmation(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Open handovers on the caller's own listings — the ones holding them."""
    await pickup_service.escalate_overdue_handovers(db)
    rows = await pickup_service.get_awaiting_confirmation(db, user)
    return [_job_response(pickup, listing, material) for pickup, listing, material in rows]


@router.post("/{pickup_id}/accept", response_model=PickupAcceptResponse)
async def accept_offer(
    pickup_id: str,
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    await pickup_service.escalate_overdue_handovers(db)
    if await pickup_service.has_open_handover(db, collector_id=collector.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Finish your open handovers before accepting new leads",
        )
    pickup, listing, material = await _load(db, pickup_id)
    if pickup.collector_id != collector.id or pickup.status != PickupStatus.offered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Offer is no longer available",
        )

    pin = await pickup_service.accept_pickup(db, pickup, listing)
    await pickup_service.enqueue_location_sms(db, collector, pickup, listing, pin)
    await db.flush()
    base = _job_response(pickup, listing, material)
    return PickupAcceptResponse(**base.model_dump(), handover_pin=pin)


@router.post("/{pickup_id}/pin", response_model=PickupAcceptResponse)
async def regenerate_pin(
    pickup_id: str,
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    """Re-issue the handover PIN (e.g. the collector lost the original SMS)."""
    pickup, listing, material = await _load(db, pickup_id)
    if pickup.collector_id != collector.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your pickup")
    if pickup.status not in (
        PickupStatus.accepted,
        PickupStatus.en_route,
        PickupStatus.arrived,
        PickupStatus.verified,
        PickupStatus.pending_confirmation,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This pickup can no longer be confirmed",
        )
    pin = pickup_service.issue_handover_pin(pickup)
    await pickup_service.enqueue_location_sms(db, collector, pickup, listing, pin)
    await db.flush()
    base = _job_response(pickup, listing, material)
    return PickupAcceptResponse(**base.model_dump(), handover_pin=pin)


@router.post("/{pickup_id}/handover", response_model=PickupJobResponse)
async def record_handover(
    pickup_id: str,
    payload: HandoverRequest,
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    """Collector records the collected weight; the seller then confirms."""
    pickup, listing, material = await _load(db, pickup_id)
    if pickup.collector_id != collector.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your pickup")
    if pickup.status not in (
        PickupStatus.accepted,
        PickupStatus.en_route,
        PickupStatus.arrived,
        PickupStatus.verified,
        PickupStatus.pending_confirmation,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This pickup is not ready for handover",
        )

    await pickup_service.record_handover(
        db,
        pickup,
        weight_kg=payload.weight_kg,
        unit_price_naira=payload.unit_price_naira,
        payment_method=payload.payment_method,
        hub_id=payload.hub_id,
    )
    await db.flush()
    return _job_response(pickup, listing, material)


@router.post("/{pickup_id}/confirm", response_model=TransactionResponse)
async def confirm_handover(
    pickup_id: str,
    payload: HandoverConfirmRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Seller enters the collector's PIN to confirm the handover."""
    pickup, listing, _material = await _load(db, pickup_id)
    if user.role != UserRole.admin and listing.seller_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the seller can confirm this handover",
        )
    try:
        return await pickup_service.confirm_handover(db, pickup, payload.pin)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
