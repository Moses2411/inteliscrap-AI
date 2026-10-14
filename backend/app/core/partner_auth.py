import hashlib
from datetime import datetime

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CompliancePartner


def hash_api_key(raw_key: str) -> str:
    """One-way hash of a partner API key for at-rest comparison."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


async def get_partner_from_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> CompliancePartner:
    # Prefer the hashed credential when present; fall back to the legacy plaintext
    # column so existing partners keep working during migration.
    hashed = hash_api_key(x_api_key)
    partner = (
        await db.execute(
            select(CompliancePartner).where(CompliancePartner.api_keys_hash == hashed)
        )
    ).scalar_one_or_none()
    if partner is None:
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
    partner.last_used_at = datetime.utcnow()
    await db.flush()
    return partner
