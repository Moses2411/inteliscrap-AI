from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SyncOutbox
from app.services import messaging_service

MAX_ATTEMPTS = 5
BASE_BACKOFF_SECONDS = 60


async def process_pending(db: AsyncSession, limit: int = 100) -> int:
    now = datetime.utcnow()
    result = await db.execute(
        select(SyncOutbox)
        .where(
            SyncOutbox.status == "pending",
            (SyncOutbox.next_retry_at.is_(None)) | (SyncOutbox.next_retry_at <= now),
        )
        .order_by(SyncOutbox.created_at.asc())
        .limit(limit)
    )
    items = list(result.scalars().all())

    sent = 0
    for item in items:
        try:
            if item.event_type == "sms.location":
                payload = item.payload or {}
                await messaging_service.send_sms(
                    payload["phone_number"], payload["message"]
                )
            else:
                raise ValueError(f"Unsupported outbox event type: {item.event_type}")
            item.status = "sent"
            item.next_retry_at = None
            sent += 1
        except Exception:
            item.attempt_count += 1
            if item.attempt_count >= MAX_ATTEMPTS:
                item.status = "failed"
                item.next_retry_at = None
            else:
                item.next_retry_at = now + timedelta(
                    seconds=BASE_BACKOFF_SECONDS * (2 ** (item.attempt_count - 1))
                )

    await db.flush()
    return sent
