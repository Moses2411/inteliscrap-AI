from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import MaterialCategory
from app.schemas import MaterialCategoryResponse

router = APIRouter(prefix="/api/v1/materials", tags=["materials"])


@router.get("", response_model=list[MaterialCategoryResponse])
async def list_materials(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MaterialCategory)
        .where(MaterialCategory.is_active.is_(True))
        .order_by(MaterialCategory.sort_order.asc())
    )
    return list(result.scalars().all())
