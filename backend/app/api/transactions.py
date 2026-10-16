from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.database import get_db
from app.models import PaymentMethod, Pickup, PickupStatus, User, UserRole
from app.schemas import SettlementRequest, TransactionResponse
from app.services import settlement_service

router = APIRouter(prefix="/api/v1", tags=["transactions"])

SETTLEABLE = {
    PickupStatus.accepted,
    PickupStatus.en_route,
    PickupStatus.arrived,
    PickupStatus.pending_confirmation,
    PickupStatus.disputed,
}


@router.post(
    "/pickups/{pickup_id}/settle",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def settle_pickup(
    pickup_id: str,
    payload: SettlementRequest,
    _user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only manual settlement.

    Collectors can no longer settle unilaterally — the seller must confirm the
    handover with the collector's PIN so the record is verified by both parties.
    """
    pickup = await db.get(Pickup, pickup_id)
    if pickup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup not found")
    if pickup.status not in SETTLEABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pickup must be accepted before settlement",
        )

    payment_method = payload.payment_method or PaymentMethod.cash
    try:
        return await settlement_service.settle_pickup(
            db,
            pickup,
            payload.weight_kg,
            payload.unit_price_naira,
            payment_method,
            hub_id=payload.hub_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
