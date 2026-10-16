from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
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
    DisputeItemResponse,
    DisputeResolveRequest,
    DisputeResolveResponse,
)
from app.services import pickup_service

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _to_float(value) -> float | None:
    return float(value) if value is not None else None


@router.get("/disputes", response_model=list[DisputeItemResponse])
async def list_disputes(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Handovers whose confirmation window elapsed without a PIN."""
    await pickup_service.escalate_overdue_handovers(db)
    result = await db.execute(
        select(Pickup, Listing, MaterialCategory)
        .join(Listing, Pickup.listing_id == Listing.id)
        .join(MaterialCategory, Listing.material_category_id == MaterialCategory.id)
        .where(Pickup.status == PickupStatus.disputed)
        .order_by(Pickup.disputed_at.asc())
    )
    rows = list(result.all())

    user_ids = {listing.seller_id for _, listing, _ in rows}
    user_ids |= {pickup.collector_id for pickup, _, _ in rows if pickup.collector_id}
    phones: dict[str, str] = {}
    if user_ids:
        users = await db.execute(select(User.id, User.phone_number).where(User.id.in_(user_ids)))
        phones = {uid: phone for uid, phone in users.all()}

    items: list[DisputeItemResponse] = []
    for pickup, listing, material in rows:
        items.append(
            DisputeItemResponse(
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
                latitude=listing.latitude,
                longitude=listing.longitude,
                accepted_at=pickup.accepted_at,
                confirm_deadline=pickup.confirm_deadline,
                disputed_at=pickup.disputed_at,
                dispute_reason=pickup.dispute_reason,
                handover_weight_kg=_to_float(pickup.handover_weight_kg),
                awaiting_confirmation=True,
                seller_id=listing.seller_id,
                collector_id=pickup.collector_id,
                seller_phone=phones.get(listing.seller_id),
                collector_phone=phones.get(pickup.collector_id) if pickup.collector_id else None,
            )
        )
    return items


@router.post("/pickups/{pickup_id}/resolve", response_model=DisputeResolveResponse)
async def resolve_dispute(
    pickup_id: str,
    payload: DisputeResolveRequest,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Force-confirm a disputed handover or cancel it and release the hold."""
    pickup = await db.get(Pickup, pickup_id)
    if pickup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup not found")

    try:
        transaction = await pickup_service.resolve_dispute(
            db, pickup, payload.resolution, payload.reason
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return DisputeResolveResponse(
        pickup_id=pickup.id,
        pickup_status=pickup.status.value,
        transaction_id=transaction.id if transaction is not None else None,
    )
