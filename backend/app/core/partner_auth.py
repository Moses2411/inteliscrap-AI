from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CompliancePartner


async def get_partner_from_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> CompliancePartner:
    partner = (
        await db.execute(
            select(CompliancePartner).where(CompliancePartner.api_key == x_api_key)
        )
    ).scalar_one_or_none()
    if partner is None or not partner.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        )
    return partner
