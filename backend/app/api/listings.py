from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models import MaterialCategory, User, UserRole
from app.schemas import ListingCreate, ListingResponse
from app.services import listing_service, pickup_service

router = APIRouter(prefix="/api/v1/listings", tags=["listings"])


@router.post("", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ListingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(MaterialCategory, payload.material_category_id)
    if material is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Material category not found"
        )
    try:
        return await listing_service.create_listing(db, user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("", response_model=list[ListingResponse])
async def list_listings(
    user: User = Depends(require_role(UserRole.collector, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Market board of active listings.

    Only collectors (and admins) browse other people's listings — they are the
    ones who accept pickups. Households/sellers see only their own via
    ``GET /api/v1/listings/mine``.
    """
    return await listing_service.list_active(db)


@router.get("/mine", response_model=list[ListingResponse])
async def list_my_listings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The authenticated user's own listings (any role)."""
    return await listing_service.get_user_listings(db, user)


@router.post("/{listing_id}/accept", response_model=ListingResponse)
async def accept_listing(
    listing_id: str,
    collector: User = Depends(require_role(UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    """Collector claims a listing straight from the market board ("Accept offer").

    Creates the pickup, marks the listing scheduled and expires any other
    pending offers on it — first accept wins.
    """
    await pickup_service.escalate_overdue_handovers(db)

    listing = await listing_service.get_listing(db, listing_id)
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    try:
        claimed = await pickup_service.claim_listing(db, listing, collector)
    except pickup_service.CollectorAtCapacity as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    if claimed is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This listing is no longer available",
        )
    pickup, pin = claimed
    await pickup_service.enqueue_location_sms(db, collector, pickup, listing, pin)
    return listing


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: str,
    user: User = Depends(require_role(UserRole.collector, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    listing = await listing_service.get_listing(db, listing_id)
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found"
        )
    return listing
