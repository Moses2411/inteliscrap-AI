from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.database import get_db
from app.models import User, UserRole
from app.services import outbox_service

router = APIRouter(prefix="/api/v1/outbox", tags=["outbox"])


@router.post("/process")
async def process_outbox(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    processed = await outbox_service.process_pending(db)
    return {"processed": processed}
