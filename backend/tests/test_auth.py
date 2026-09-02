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
