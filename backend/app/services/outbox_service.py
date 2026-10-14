"""SMS / notification outbox worker.

Reliability contract:
- **Retryable** failures (network, timeout, provider 5xx/429, provider not yet
  configured) are retried with exponential backoff + jitter up to
  ``max_attempts``.
- **Non-retryable** failures (malformed payload, unsupported event type) go
  straight to the dead-letter state (``dead_letter``) so they are never retried
  forever and can be inspected/handled by an operator.
- Every terminal attempt records ``error_code`` and ``last_error`` for
  observability; successful sends record ``sent_at`` and ``provider_message_id``.
"""

import random
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SyncOutbox
from app.services import messaging_service

MAX_ATTEMPTS = 5
BASE_BACKOFF_SECONDS = 60
MAX_BACKOFF_SECONDS = 3600

SUPPORTED_EVENTS = {"sms.location", "sms.new_offer"}


def _backoff_seconds(attempt: int) -> int:
    exponential = BASE_BACKOFF_SECONDS * (2 ** max(attempt - 1, 0))
    capped = min(exponential, MAX_BACKOFF_SECONDS)
    jitter = random.uniform(0, capped * 0.25)  # avoid thundering herd
    return int(capped + jitter)


def _classify_error(exc: Exception) -> tuple[bool, str]:
    """Return (retryable, error_code)."""
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code if exc.response is not None else None
        if status is not None and status in (408, 425, 429) or (status is not None and status >= 500):
            return True, f"http_{status}"
        return False, f"http_{status}"
    if isinstance(exc, (httpx.TimeoutException, httpx.TransportError)):
        return True, "network_error"
    if isinstance(exc, (ValueError, KeyError)):
        return False, "invalid_payload"
    if isinstance(exc, RuntimeError):
        # e.g. provider credentials not configured yet — worth retrying.
        return True, "provider_unconfigured"
    return True, "unknown_error"


async def _send(item: SyncOutbox) -> dict:
    if item.event_type not in SUPPORTED_EVENTS:
        raise ValueError(f"Unsupported outbox event type: {item.event_type}")
    payload = item.payload or {}
    return await messaging_service.send_sms(payload["phone_number"], payload["message"])


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
        max_attempts = item.max_attempts or MAX_ATTEMPTS
        try:
            response = await _send(item)
            item.status = "sent"
            item.sent_at = datetime.utcnow()
            item.next_retry_at = None
            item.error_code = None
            item.last_error = None
            message_id = None
            if isinstance(response, dict):
                recipients = (response.get("SMSMessageData") or {}).get("Recipients") or []
                if recipients:
                    message_id = recipients[0].get("messageId")
            item.provider_message_id = message_id or item.provider_message_id
            sent += 1
        except Exception as exc:  # noqa: BLE001 - we persist structured failure info
            retryable, error_code = _classify_error(exc)
            item.attempt_count += 1
            item.error_code = error_code
            item.last_error = str(exc)[:500]
            if not retryable:
                item.status = "dead_letter"
                item.next_retry_at = None
            elif item.attempt_count >= max_attempts:
                item.status = "failed"
                item.next_retry_at = None
            else:
                item.next_retry_at = now + timedelta(
                    seconds=_backoff_seconds(item.attempt_count)
                )

    await db.flush()
    return sent


async def list_by_status(db: AsyncSession, status: str, limit: int = 100) -> list[SyncOutbox]:
    result = await db.execute(
        select(SyncOutbox)
        .where(SyncOutbox.status == status)
        .order_by(SyncOutbox.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def retry_item(db: AsyncSession, item_id: str) -> SyncOutbox | None:
    """Reset a failed/dead-letter item so the worker picks it up again."""
    result = await db.execute(select(SyncOutbox).where(SyncOutbox.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        return None
    item.status = "pending"
    item.attempt_count = 0
    item.next_retry_at = None
    item.error_code = None
    await db.flush()
    return item
