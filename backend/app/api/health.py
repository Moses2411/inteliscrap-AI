from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.schemas import HealthResponse
from fastapi import Depends

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return HealthResponse(
        status="ok",
        version="0.1.0",
        database=db_status,
    )
