from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_data_access
from app.database import get_db
from app.models import User, UserRole
from app.schemas import ComplianceManifestoResponse
from app.services import compliance_service

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


@router.get("/manifesto", response_model=ComplianceManifestoResponse)
async def get_manifesto(
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(require_data_access(UserRole.ngo, UserRole.partner)),
    db: AsyncSession = Depends(get_db),
):
    """Network-wide settled-collection manifest for premium EPR/NGO subscribers."""
    return await compliance_service.generate_manifesto(
        db, user, date_from=date_from, date_to=date_to
    )
