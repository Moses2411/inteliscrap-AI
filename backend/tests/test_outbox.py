from datetime import datetime, timedelta

import pytest

from app.core import security
from app.models import SyncOutbox, User, UserRole


async def _make_admin_token(test_session) -> str:
    admin = User(
        id="outbox-admin",
        phone_number="+2348070000001",
        role=UserRole.admin,
        is_verified=True,
    )
    test_session.add(admin)
    await test_session.flush()
    return security.create_access_token(admin.id, admin.role.value)


@pytest.mark.asyncio
async def test_outbox_requires_admin(client):
    resp = await client.post("/api/v1/outbox/process")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_outbox_backoff_then_fail(client, test_session):
    token = await _make_admin_token(test_session)
    item = SyncOutbox(
        id="outbox-1",
        aggregate_type="pickup",
        aggregate_id="p1",
        event_type="sms.location",
        payload={"phone_number": "+234", "message": "hello"},
        status="pending",
    )
    test_session.add(item)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/outbox/process", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.json()["processed"] == 0
    await test_session.refresh(item)
    assert item.attempt_count == 1
    assert item.status == "pending"
    assert item.next_retry_at is not None

    item.attempt_count = 4
    item.next_retry_at = datetime.utcnow() - timedelta(seconds=10)
    await test_session.flush()

    await client.post("/api/v1/outbox/process", headers={"Authorization": f"Bearer {token}"})
    await test_session.refresh(item)
    assert item.status == "failed"
    assert item.attempt_count == 5
