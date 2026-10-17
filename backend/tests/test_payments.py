"""MTN MoMo subscription checkout: end-to-end with the MoMo API stubbed.

No network calls are made — ``momo_service.request_to_pay`` and
``get_payment_status`` are monkeypatched, so these tests exercise our pricing,
persistence, callback/poll handling and one-time subscription activation.
"""

import pytest
from sqlalchemy import func, select

from app.config import settings
from app.core import security
from app.models import (
    HubSubscription,
    PaymentStatus,
    PaymentTransaction,
    RecyclingHub,
    User,
    UserRole,
    UserSubscription,
)
from app.services import momo_service


async def _enable_momo(monkeypatch):
    monkeypatch.setattr(settings, "momo_enabled", True)
    monkeypatch.setattr(settings, "momo_subscription_key", "test-subscription-key")
    monkeypatch.setattr(settings, "momo_api_user", "00000000-0000-0000-0000-000000000001")
    monkeypatch.setattr(settings, "momo_api_key", "test-api-key")
    monkeypatch.setattr(settings, "momo_currency", "EUR")
    monkeypatch.setattr(settings, "momo_callback_base_url", "")


def _auth(user_id: str, role: UserRole) -> dict[str, str]:
    token = security.create_access_token(user_id, role.value)
    return {"Authorization": f"Bearer {token}"}


async def _seed_user(test_session, *, user_id, phone, role=UserRole.seller) -> User:
    user = User(id=user_id, phone_number=phone, role=role, location_hub="Zaria")
    test_session.add(user)
    await test_session.flush()
    return user


# ── Config / gating ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_momo_config_disabled_by_default(client, monkeypatch):
    monkeypatch.setattr(settings, "momo_enabled", False)
    resp = await client.get("/api/v1/payments/momo/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is False
    assert "currency" in body


@pytest.mark.asyncio
async def test_checkout_503_when_not_configured(client, test_session, monkeypatch):
    monkeypatch.setattr(settings, "momo_enabled", False)
    await _seed_user(test_session, user_id="pay-off", phone="+2348070000001")
    resp = await client.post(
        "/api/v1/payments/momo/checkout",
        json={"plan": "quarterly", "phone_number": "08030000001"},
        headers=_auth("pay-off", UserRole.seller),
    )
    assert resp.status_code == 503


# ── Checkout ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_checkout_creates_pending_payment(client, test_session, monkeypatch):
    await _enable_momo(monkeypatch)
    calls: list[dict] = []

    async def fake_rtp(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(momo_service, "request_to_pay", fake_rtp)
    await _seed_user(test_session, user_id="pay-user-1", phone="+2348070000010")

    resp = await client.post(
        "/api/v1/payments/momo/checkout",
        json={"plan": "quarterly", "phone_number": "0803 000 0010"},
        headers=_auth("pay-user-1", UserRole.seller),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["purpose"] == "user_subscription"
    assert body["amount"] == 2500.0
    assert body["currency"] == "EUR"
    # Local number normalised to an MSISDN before being sent to MoMo.
    assert body["payer_msisdn"] == "2348030000010"

    # The prompt actually carried our reference and the normalised number.
    assert len(calls) == 1
    assert calls[0]["msisdn"] == "2348030000010"
    assert calls[0]["reference_id"] == body["reference_id"]

    row = (
        await test_session.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.reference_id == body["reference_id"]
            )
        )
    ).scalar_one()
    assert row.status == PaymentStatus.pending
    assert row.applied is False


@pytest.mark.asyncio
async def test_checkout_failure_marks_payment_failed(client, test_session, monkeypatch):
    await _enable_momo(monkeypatch)

    async def boom(**kwargs):
        raise momo_service.MomoError("payer rejected", status_code=400)

    monkeypatch.setattr(momo_service, "request_to_pay", boom)
    await _seed_user(test_session, user_id="pay-user-fail", phone="+2348070000011")

    resp = await client.post(
        "/api/v1/payments/momo/checkout",
        json={"plan": "quarterly", "phone_number": "08030000011"},
        headers=_auth("pay-user-fail", UserRole.seller),
    )
    assert resp.status_code == 400

    rows = (
        await test_session.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.user_id == "pay-user-fail"
            )
        )
    ).scalars().all()
    assert rows and rows[0].status == PaymentStatus.failed


# ── Callback / polling → activation ──────────────────────────────────


async def _checkout(client, test_session, monkeypatch, *, user_id, phone, role=UserRole.seller):
    await _enable_momo(monkeypatch)

    async def fake_rtp(**kwargs):
        return None

    monkeypatch.setattr(momo_service, "request_to_pay", fake_rtp)
    await _seed_user(test_session, user_id=user_id, phone=phone, role=role)
    resp = await client.post(
        "/api/v1/payments/momo/checkout",
        json={"plan": "quarterly", "phone_number": phone},
        headers=_auth(user_id, role),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["reference_id"]


@pytest.mark.asyncio
async def test_callback_success_activates_subscription(client, test_session, monkeypatch):
    ref = await _checkout(
        client, test_session, monkeypatch, user_id="pay-ok", phone="+2348070000020"
    )

    resp = await client.post(
        f"/api/v1/payments/momo/callback/{ref}",
        json={"status": "SUCCESSFUL", "financialTransactionId": "FIN123", "reason": ""},
    )
    assert resp.status_code == 200
    assert resp.json()["received"] is True

    status = await client.get(
        f"/api/v1/payments/{ref}", headers=_auth("pay-ok", UserRole.seller)
    )
    assert status.status_code == 200
    body = status.json()
    assert body["status"] == "successful"
    assert body["applied"] is True
    assert body["subscription"]["plan"] == "quarterly"

    user = await test_session.get(User, "pay-ok")
    assert user.subscription_plan.value == "quarterly"


@pytest.mark.asyncio
async def test_seller_premium_checkout_and_activation(client, test_session, monkeypatch):
    await _enable_momo(monkeypatch)

    async def fake_rtp(**kwargs):
        return None

    monkeypatch.setattr(momo_service, "request_to_pay", fake_rtp)
    await _seed_user(test_session, user_id="pay-premium", phone="+2348070000050")

    resp = await client.post(
        "/api/v1/payments/momo/checkout",
        json={"plan": "seller_yearly", "phone_number": "08030000050"},
        headers=_auth("pay-premium", UserRole.seller),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 4900.0
    ref = resp.json()["reference_id"]

    cb = await client.post(
        f"/api/v1/payments/momo/callback/{ref}",
        json={"status": "SUCCESSFUL", "financialTransactionId": "FINPREMIUM"},
    )
    assert cb.status_code == 200

    user = await test_session.get(User, "pay-premium")
    assert user.subscription_plan.value == "seller_yearly"
    assert user.subscription_expires_at is not None


@pytest.mark.asyncio
async def test_premium_plan_must_match_role(client, test_session, monkeypatch):
    await _enable_momo(monkeypatch)

    async def fake_rtp(**kwargs):
        return None

    monkeypatch.setattr(momo_service, "request_to_pay", fake_rtp)
    await _seed_user(test_session, user_id="pay-wrongrole", phone="+2348070000051")

    # A seller cannot buy the NGO plan.
    resp = await client.post(
        "/api/v1/payments/momo/checkout",
        json={"plan": "ngo_yearly", "phone_number": "08030000051"},
        headers=_auth("pay-wrongrole", UserRole.seller),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_callback_is_idempotent(client, test_session, monkeypatch):
    ref = await _checkout(
        client, test_session, monkeypatch, user_id="pay-idem", phone="+2348070000021"
    )
    payload = {"status": "SUCCESSFUL", "financialTransactionId": "FIN999"}

    for _ in range(2):
        resp = await client.post(f"/api/v1/payments/momo/callback/{ref}", json=payload)
        assert resp.status_code == 200

    count = (
        await test_session.execute(
            select(func.count())
            .select_from(UserSubscription)
            .where(UserSubscription.user_id == "pay-idem")
        )
    ).scalar_one()
    assert count == 1


@pytest.mark.asyncio
async def test_failed_callback_does_not_activate(client, test_session, monkeypatch):
    ref = await _checkout(
        client, test_session, monkeypatch, user_id="pay-fail", phone="+2348070000022"
    )
    resp = await client.post(
        f"/api/v1/payments/momo/callback/{ref}",
        json={"status": "FAILED", "reason": "Insufficient funds"},
    )
    assert resp.status_code == 200

    status = await client.get(
        f"/api/v1/payments/{ref}", headers=_auth("pay-fail", UserRole.seller)
    )
    body = status.json()
    assert body["status"] == "failed"
    assert body["applied"] is False
    assert "Insufficient" in (body["failure_reason"] or "")

    user = await test_session.get(User, "pay-fail")
    assert user.subscription_plan.value == "freemium"


@pytest.mark.asyncio
async def test_refresh_polls_momo_and_activates(client, test_session, monkeypatch):
    ref = await _checkout(
        client, test_session, monkeypatch, user_id="pay-refresh", phone="+2348070000023"
    )

    async def fake_status(reference_id):
        assert reference_id == ref
        return {"status": "SUCCESSFUL", "financialTransactionId": "FIN777"}

    monkeypatch.setattr(momo_service, "get_payment_status", fake_status)

    resp = await client.post(
        f"/api/v1/payments/{ref}/refresh",
        headers=_auth("pay-refresh", UserRole.seller),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "successful"
    assert body["applied"] is True


@pytest.mark.asyncio
async def test_cannot_read_another_users_payment(client, test_session, monkeypatch):
    ref = await _checkout(
        client, test_session, monkeypatch, user_id="pay-owner", phone="+2348070000024"
    )
    await _seed_user(test_session, user_id="pay-intruder", phone="+2348070000025")
    resp = await client.get(
        f"/api/v1/payments/{ref}", headers=_auth("pay-intruder", UserRole.seller)
    )
    assert resp.status_code == 404


# ── Hub subscriptions ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hub_checkout_requires_registered_hub(client, test_session, monkeypatch):
    await _enable_momo(monkeypatch)

    async def fake_rtp(**kwargs):
        return None

    monkeypatch.setattr(momo_service, "request_to_pay", fake_rtp)
    await _seed_user(
        test_session, user_id="hub-none", phone="+2348070000030", role=UserRole.recycling_hub
    )
    resp = await client.post(
        "/api/v1/payments/momo/checkout",
        json={
            "plan": "Pro",
            "phone_number": "08030000030",
            "purpose": "hub_subscription",
        },
        headers=_auth("hub-none", UserRole.recycling_hub),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_hub_checkout_and_callback_activates_hub_subscription(
    client, test_session, monkeypatch
):
    await _enable_momo(monkeypatch)

    async def fake_rtp(**kwargs):
        return None

    monkeypatch.setattr(momo_service, "request_to_pay", fake_rtp)
    owner = await _seed_user(
        test_session, user_id="hub-pay", phone="+2348070000031", role=UserRole.recycling_hub
    )
    hub = RecyclingHub(owner_user_id=owner.id, name="PayHub", city="Zaria")
    test_session.add(hub)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/payments/momo/checkout",
        json={
            "plan": "Pro",
            "phone_number": "08030000031",
            "purpose": "hub_subscription",
        },
        headers=_auth("hub-pay", UserRole.recycling_hub),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 25000.0
    ref = resp.json()["reference_id"]

    cb = await client.post(
        f"/api/v1/payments/momo/callback/{ref}",
        json={"status": "SUCCESSFUL", "financialTransactionId": "FINHUB"},
    )
    assert cb.status_code == 200

    sub = (
        await test_session.execute(
            select(HubSubscription).where(HubSubscription.hub_id == hub.id)
        )
    ).scalar_one()
    assert sub.status.value == "active"
    assert float(sub.amount_naira) == 25000.0


# ── Provisioning ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_provision_requires_admin(client, test_session, monkeypatch):
    await _enable_momo(monkeypatch)
    await _seed_user(test_session, user_id="pay-non-admin", phone="+2348070000040")
    resp = await client.post(
        "/api/v1/payments/momo/provision",
        headers=_auth("pay-non-admin", UserRole.seller),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_provision_returns_keys_for_admin(client, test_session, monkeypatch):
    await _enable_momo(monkeypatch)

    async def fake_provision(*, callback_host="", reference_id=None):
        return "11111111-1111-1111-1111-111111111111", "apikey-xyz"

    monkeypatch.setattr(momo_service, "provision_api_user", fake_provision)
    await _seed_user(
        test_session, user_id="pay-admin", phone="+2348070000041", role=UserRole.admin
    )
    resp = await client.post(
        "/api/v1/payments/momo/provision",
        json={"callback_host": "inteliscrap.example.com"},
        headers=_auth("pay-admin", UserRole.admin),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["api_user"].startswith("1111")
    assert body["api_key"] == "apikey-xyz"


# ── Unit: MSISDN normalisation ───────────────────────────────────────


def test_normalize_msisdn_variants():
    assert momo_service.normalize_msisdn("0803 123 4567") == "2348031234567"
    assert momo_service.normalize_msisdn("+2348031234567") == "2348031234567"
    assert momo_service.normalize_msisdn("2348031234567") == "2348031234567"
    assert momo_service.normalize_msisdn("08031234567", country_code="254") == "2548031234567"


def test_map_status():
    assert momo_service.map_status("SUCCESSFUL") == "successful"
    assert momo_service.map_status("FAILED") == "failed"
    assert momo_service.map_status("REJECTED") == "failed"
    assert momo_service.map_status("PENDING") == "pending"
    assert momo_service.map_status(None) == "pending"
