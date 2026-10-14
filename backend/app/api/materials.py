from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import MaterialCategoryResponse
from app.services import price_service

router = APIRouter(prefix="/api/v1/materials", tags=["materials"])


@router.get("", response_model=list[MaterialCategoryResponse])
async def list_materials(db: AsyncSession = Depends(get_db)):
    # One canonical read path, with price freshness computed consistently.
    return await price_service.get_all(db)
