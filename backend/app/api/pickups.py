from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
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
        location_precision=listing.location_precision,
        contact_phone=listing.contact_phone,
        contact_shared=listing.contact_phone is not None,
        distance_m=pickup.distance_m,
        created_at=listing.created_at,
    )


def _job_response(
    pickup: Pickup,
    listing: Listing,
    material: MaterialCategory,
    *,
    include_pin: bool = False,
    collector_phone: str | None = None,
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
        location_precision=listing.location_precision,
        scheduled_at=pickup.scheduled_at,
        accepted_at=pickup.accepted_at,
        confirm_deadline=pickup.confirm_deadline,
        confirmed_at=pickup.confirmed_at,
        disputed_at=pickup.disputed_at,
        dispute_reason=pickup.dispute_reason,
        handover_weight_kg=_to_float(pickup.handover_weight_kg),
        awaiting_confirmation=pickup.status
        in (PickupStatus.pending_confirmation, PickupStatus.disputed),
        # Only the seller sees the code (and the collector's number to call).
        handover_pin=pickup.pin_cache if include_pin else None,
        collector_phone=collector_phone if include_pin else None,
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
    # No new leads once every concurrent job slot is taken.
    capacity = await pickup_service.collector_capacity(db, collector.id)
    if capacity.at_capacity:
        return []
    rows = await pickup_service.get_pending_offers(db, collector)
    return [_offer_response(pickup, listing, material) for pickup, listing, material in rows]


@router.get("/hold", response_model=HoldStatusResponse)
async def hold_status(
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    """How many job slots the collector is using and whether new leads pause."""
    await pickup_service.escalate_overdue_handovers(db)
    capacity = await pickup_service.collector_capacity(db, collector.id)
    open_handovers = await pickup_service.count_open_handovers(db, collector.id)
    return HoldStatusResponse(
        on_hold=capacity.at_capacity,
        open_handovers=open_handovers,
        active_jobs=capacity.active_jobs,
        max_concurrent_jobs=capacity.max_jobs,
        remaining_slots=capacity.remaining_slots,
    )


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
    """Open handovers on the caller's own listings — the seller's job board.

    Each row carries the confirmation code (``handover_pin``) the seller reads
    to the collector, plus the collector's phone so they can call them.
    """
    await pickup_service.escalate_overdue_handovers(db)
    rows = await pickup_service.get_awaiting_confirmation(db, user)

    # Jobs accepted before the code was cached (or after a restore from a
    # pre-migration backup) would show no code — mint one on first read.
    minted = False
    for pickup, _, _ in rows:
        if pickup.pin_cache is None and pickup.status in pickup_service.HOLD_STATUSES:
            pickup_service.issue_handover_pin(pickup)
            minted = True
    if minted:
        await db.flush()

    collector_ids = {pickup.collector_id for pickup, _, _ in rows if pickup.collector_id}
    collectors: dict[str, User] = {}
    if collector_ids:
        result = await db.execute(select(User).where(User.id.in_(collector_ids)))
        collectors = {u.id: u for u in result.scalars()}

    return [
        _job_response(
            pickup,
            listing,
            material,
            include_pin=True,
            collector_phone=collectors[pickup.collector_id].phone_number
            if pickup.collector_id in collectors
            else None,
        )
        for pickup, listing, material in rows
    ]


@router.post("/{pickup_id}/accept", response_model=PickupJobResponse)
async def accept_offer(
    pickup_id: str,
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    """Collector accepts an offer. The confirmation code goes to the seller,
    who reads it out at handover — the collector never sees it here.
    """
    await pickup_service.escalate_overdue_handovers(db)
    pickup, listing, material = await _load(db, pickup_id)
    if pickup.collector_id != collector.id or pickup.status != PickupStatus.offered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Offer is no longer available",
        )

    try:
        pin = await pickup_service.accept_pickup(db, pickup, listing)
    except pickup_service.CollectorAtCapacity as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    await pickup_service.enqueue_location_sms(db, collector, pickup, listing, pin)
    await db.flush()
    return _job_response(pickup, listing, material)


@router.post("/{pickup_id}/pin", response_model=PickupAcceptResponse)
async def regenerate_pin(
    pickup_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-issue the handover code (e.g. the seller lost the original).

    Only the listing's seller (or an admin) may re-issue it; re-issuing
    invalidates the previous code.
    """
    pickup, listing, material = await _load(db, pickup_id)
    if user.role != UserRole.admin and listing.seller_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your listing")
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
    collector = await db.get(User, pickup.collector_id) if pickup.collector_id else None
    if collector is not None:
        await pickup_service.enqueue_location_sms(db, collector, pickup, listing, pin)
    await db.flush()
    data = _job_response(pickup, listing, material).model_dump()
    data["handover_pin"] = pin
    return PickupAcceptResponse(**data)


@router.post("/{pickup_id}/handover", response_model=PickupJobResponse)
async def record_handover(
    pickup_id: str,
    payload: HandoverRequest,
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    """Collector records the collected weight; they then enter the code."""
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
    """The collector enters the seller's code to complete the handover.

    The listing's own collector, the seller, or an admin may confirm — the
    two-party code is what authenticates the handover, not the caller's role.
    """
    pickup, listing, _material = await _load(db, pickup_id)
    is_party = (
        user.role == UserRole.admin
        or listing.seller_id == user.id
        or (pickup.collector_id is not None and pickup.collector_id == user.id)
    )
    if not is_party:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the parties to this handover can confirm it",
        )
    try:
        return await pickup_service.confirm_handover(db, pickup, payload.pin)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
