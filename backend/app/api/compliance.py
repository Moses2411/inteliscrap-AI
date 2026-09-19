from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.partner_auth import get_partner_from_api_key
from app.database import get_db
from app.models import CompliancePartner
from app.schemas import ComplianceManifestoResponse
from app.services import compliance_service

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


@router.get("/manifesto", response_model=ComplianceManifestoResponse)
async def get_manifesto(
    date_from: date | None = None,
    date_to: date | None = None,
    partner: CompliancePartner = Depends(get_partner_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    return await compliance_service.generate_manifesto(
        db, partner, date_from=date_from, date_to=date_to
    )
