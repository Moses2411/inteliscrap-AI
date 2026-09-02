from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models import MaterialCategory, User
from app.schemas import ListingCreate, ListingResponse
from app.services import listing_service

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
    return await listing_service.create_listing(db, user, payload)


@router.get("", response_model=list[ListingResponse])
async def list_listings(db: AsyncSession = Depends(get_db)):
    return await listing_service.list_active(db)


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: str, db: AsyncSession = Depends(get_db)):
    listing = await listing_service.get_listing(db, listing_id)
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found"
        )
    return listing
