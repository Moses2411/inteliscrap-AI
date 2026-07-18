from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import SyncPayload, SyncResponse, PriceMatrixItem, ScrapScanResponse
from app.services import sync_service

router = APIRouter(prefix="/api/v1", tags=["sync"])


@router.post("/sync", response_model=SyncResponse)
async def synchronize_client(payload: SyncPayload, db: AsyncSession = Depends(get_db)):
    synced_ids = await sync_service.process_scans(db, payload.user_id, payload.local_scans)
    prices = await sync_service.get_latest_prices(db)

    return SyncResponse(
        status="success",
        synced_ids=synced_ids,
        latest_prices=[
            PriceMatrixItem(
                material_class=p.material_class,
                price_per_kg_naira=p.price_per_kg_naira,
            )
            for p in prices
        ],
        server_time=datetime.utcnow(),
    )
