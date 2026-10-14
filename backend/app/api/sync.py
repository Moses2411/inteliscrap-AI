from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import SyncPayload, SyncResponse, PriceMatrixItem, ScrapScanResponse
from app.services import price_service, sync_service

router = APIRouter(prefix="/api/v1", tags=["sync"])


@router.post("/sync", response_model=SyncResponse)
async def synchronize_client(payload: SyncPayload, db: AsyncSession = Depends(get_db)):
    synced_ids = await sync_service.process_scans(db, payload.user_id, payload.local_scans)
    prices = await sync_service.get_latest_prices(db)
    price_service.with_freshness(prices)

    return SyncResponse(
        status="success",
        synced_ids=synced_ids,
        latest_prices=[
            PriceMatrixItem(
                material_class=p.slug,
                name=p.name,
                price_per_kg_naira=float(p.price_per_kg_naira),
                carbon_kg_co2e_per_kg=float(p.carbon_kg_co2e_per_kg or 0),
                price_last_updated_at=p.price_last_updated_at,
                price_source=p.price_source or "seed",
                price_version=p.price_version or 1,
                is_stale=bool(getattr(p, "is_stale", False)),
            )
            for p in prices
        ],
        server_time=datetime.utcnow(),
    )
