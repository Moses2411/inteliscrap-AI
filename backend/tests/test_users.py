import pytest

from app.core import security
from app.models import User, UserRole


async def _household_headers(test_session, phone="+2348070000001"):
    user = User(id=f"uloc-{phone}", phone_number=phone, role=UserRole.household)
    test_session.add(user)
    await test_session.flush()
    token = security.create_access_token(user.id, UserRole.household.value)
    return {"Authorization": f"Bearer {token}"}, user


@pytest.mark.asyncio
async def test_update_location_populates_h3_cell(client, test_session):
    headers, user = await _household_headers(test_session, phone="+2348070000002")
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
