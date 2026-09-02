from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.database import get_db
from app.models import User, UserRole
from app.schemas import ImpactByMaterial, ImpactDailyPoint, ImpactSummary
from app.services import impact_service

router = APIRouter(prefix="/api/v1/impact", tags=["impact"])


@router.get("/summary", response_model=ImpactSummary)
async def impact_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.ngo)),
):
    return await impact_service.get_summary(db)


@router.get("/daily", response_model=list[ImpactDailyPoint])
async def impact_daily(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.ngo)),
):
    return await impact_service.get_daily(db)


@router.get("/by-material", response_model=list[ImpactByMaterial])
async def impact_by_material(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.ngo)),
):
    return await impact_service.get_by_material(db)
