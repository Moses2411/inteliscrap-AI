from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import PriceMatrixItem, PriceMatrixUpdate
from app.services import price_service

router = APIRouter(prefix="/api/v1/prices", tags=["prices"])


@router.get("/", response_model=list[PriceMatrixItem])
async def list_prices(db: AsyncSession = Depends(get_db)):
    prices = await price_service.get_all(db)
    return [
        PriceMatrixItem(
            material_class=p.material_class,
            price_per_kg_naira=p.price_per_kg_naira,
        )
        for p in prices
    ]


@router.put("/{material_class}", response_model=PriceMatrixItem)
async def update_price(material_class: str, payload: PriceMatrixUpdate, db: AsyncSession = Depends(get_db)):
    updated = await price_service.upsert_price(db, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material class not found",
        )
    return PriceMatrixItem(
        material_class=updated.material_class,
        price_per_kg_naira=updated.price_per_kg_naira,
    )
