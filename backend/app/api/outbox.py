from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.database import get_db
from app.models import User, UserRole
from app.services import outbox_service

router = APIRouter(prefix="/api/v1/outbox", tags=["outbox"])

_ALLOWED_STATUSES = {"pending", "sent", "failed", "dead_letter"}


def _serialize(item) -> dict:
    return {
        "id": item.id,
        "event_type": item.event_type,
        "status": item.status,
        "attempt_count": item.attempt_count,
        "max_attempts": item.max_attempts,
        "next_retry_at": item.next_retry_at,
        "sent_at": item.sent_at,
        "provider_message_id": item.provider_message_id,
        "error_code": item.error_code,
        "last_error": item.last_error,
        "created_at": item.created_at,
    }


@router.post("/process")
async def process_outbox(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    processed = await outbox_service.process_pending(db)
    return {"processed": processed}


@router.get("/messages")
async def list_outbox(
    status_filter: str = "pending",
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    if status_filter not in _ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"status_filter must be one of {sorted(_ALLOWED_STATUSES)}",
        )
    items = await outbox_service.list_by_status(db, status_filter, limit=limit)
    return {"status": status_filter, "count": len(items), "items": [_serialize(i) for i in items]}


@router.get("/dead-letter")
async def list_dead_letter(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    items = await outbox_service.list_by_status(db, "dead_letter", limit=limit)
    return {"count": len(items), "items": [_serialize(i) for i in items]}


@router.post("/{item_id}/retry")
async def retry_outbox_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    item = await outbox_service.retry_item(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbox item not found")
    return {"status": "ok", "item": _serialize(item)}
