import pytest


@pytest.mark.asyncio
async def test_otp_flow_and_me(client):
    phone = "+2348080000001"
    resp = await client.post("/api/v1/auth/otp/request", json={"phone_number": phone})
    assert resp.status_code == 200
    otp = resp.json()["otp"]
    assert otp is not None

    verify = await client.post(
        "/api/v1/auth/otp/verify", json={"phone_number": phone, "otp_code": otp}
    )
    assert verify.status_code == 200
    token = verify.json()["access_token"]

    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["phone_number"] == phone


@pytest.mark.asyncio
async def test_otp_verify_rejects_wrong_code(client):
    phone = "+2348080000002"
    resp = await client.post("/api/v1/auth/otp/request", json={"phone_number": phone})
    otp = resp.json()["otp"]
    wrong = "000000" if otp != "000000" else "000001"

    verify = await client.post(
        "/api/v1/auth/otp/verify", json={"phone_number": phone, "otp_code": wrong}
    )
    assert verify.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_token(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_mock_otp_code_verifies(client):
    from app.config import settings

    phone = "+2348080000099"
    resp = await client.post("/api/v1/auth/otp/request", json={"phone_number": phone})
    assert resp.status_code == 200
    assert resp.json()["otp"] is not None

    verify = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone_number": phone, "otp_code": settings.mock_otp_code},
    )
    assert verify.status_code == 200
    assert verify.json()["role"] == "household"


@pytest.mark.asyncio
async def test_explicit_role_applies_to_existing_user(client, test_session):
    from app.models import User, UserRole

    phone = "+2348080000050"
    test_session.add(User(id="role-existing", phone_number=phone, role=UserRole.household))
    await test_session.flush()

    resp = await client.post(
        "/api/v1/auth/otp/request", json={"phone_number": phone, "role": "collector"}
    )
    assert resp.status_code == 200

    from sqlalchemy import select

    user = (
        await test_session.execute(select(User).where(User.phone_number == phone))
    ).scalar_one()
    assert user.role == UserRole.collector


@pytest.mark.asyncio
async def test_omitted_role_keeps_existing_role(client, test_session):
    from sqlalchemy import select

    from app.models import User, UserRole

    phone = "+2348080000051"
    test_session.add(User(id="role-keeper", phone_number=phone, role=UserRole.collector))
    await test_session.flush()

    resp = await client.post("/api/v1/auth/otp/request", json={"phone_number": phone})
    assert resp.status_code == 200

    user = (
        await test_session.execute(select(User).where(User.phone_number == phone))
    ).scalar_one()
    assert user.role == UserRole.collector
