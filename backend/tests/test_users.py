import pytest

from app.core import security
from app.models import User, UserRole


async def _seller_headers(test_session, phone="+2348070000001"):
    user = User(id=f"uloc-{phone}", phone_number=phone, role=UserRole.seller)
    test_session.add(user)
    await test_session.flush()
    token = security.create_access_token(user.id, UserRole.seller.value)
    return {"Authorization": f"Bearer {token}"}, user


@pytest.mark.asyncio
async def test_update_location_populates_h3_cell(client, test_session):
    headers, user = await _seller_headers(test_session, phone="+2348070000002")
    resp = await client.patch(
        "/api/v1/users/me/location",
        json={"latitude": 11.0855, "longitude": 7.7195},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == user.id
    assert user.h3_cell is not None
    assert user.latitude == 11.0855


@pytest.mark.asyncio
async def test_update_location_requires_auth(client, test_session):
    resp = await client.patch(
        "/api/v1/users/me/location",
        json={"latitude": 11.0, "longitude": 7.0},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_role_cannot_be_changed_via_api(client, test_session):
    headers, user = await _seller_headers(test_session, phone="+2348070000003")

    # The role-switch endpoint is gone — one phone number, one account type.
    resp = await client.patch(
        "/api/v1/users/me/role", json={"role": "collector"}, headers=headers
    )
    assert resp.status_code == 404
    assert user.role == UserRole.seller

    # A collector-only route stays forbidden for the seller account.
    blocked = await client.get("/api/v1/pickups/offers", headers=headers)
    assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_reauthentication_does_not_change_role(client, test_session):
    """Logging in again (even choosing a different role) keeps the account type."""
    user = User(id="uloc-lock", phone_number="+2348070000004", role=UserRole.seller)
    test_session.add(user)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/auth/otp/request",
        json={"phone_number": "+2348070000004", "role": "collector"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["account_exists"] is True
    assert body["role"] == "seller"
    assert user.role == UserRole.seller
