import pytest
from sqlalchemy import select

from app.core import security
from app.models import MaterialCategory, Pickup, User, UserRole


async def _household_headers(test_session, phone="+2348090000001"):
    user = User(id=f"auth-{phone}", phone_number=phone, role=UserRole.household)
    test_session.add(user)
    await test_session.flush()
    token = security.create_access_token(user.id, UserRole.household.value)
    return {"Authorization": f"Bearer {token}"}, user


@pytest.mark.asyncio
async def test_create_listing_dispatches(client, test_session):
    headers, seller = await _household_headers(test_session)
    material = MaterialCategory(slug="copper", name="Copper", price_per_kg_naira=3200)
    collector = User(
        id="listing-collector",
        phone_number="+2348090000002",
        role=UserRole.collector,
        latitude=11.0,
        longitude=7.0,
        is_active=True,
    )
    test_session.add_all([material, collector])
    await test_session.flush()

    resp = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "estimated_weight_kg": 5,
            "estimated_value_naira": 16000,
            "latitude": 11.0,
            "longitude": 7.0,
            "auto_dispatch": True,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "matched"
    assert data["seller_id"] == seller.id

    offers = (
        await test_session.execute(select(Pickup).where(Pickup.listing_id == data["id"]))
    ).scalars().all()
    assert len(offers) == 1


@pytest.mark.asyncio
async def test_create_listing_requires_auth(client, test_session):
    material = MaterialCategory(slug="copper", name="Copper", price_per_kg_naira=3200)
    test_session.add(material)
    await test_session.flush()
    resp = await client.post(
        "/api/v1/listings", json={"material_category_id": material.id}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_listing_unknown_material(client, test_session):
    headers, _ = await _household_headers(test_session, phone="+2348090000003")
    resp = await client.post(
        "/api/v1/listings",
        json={"material_category_id": 99999},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_and_get_listing(client, test_session):
    headers, _ = await _household_headers(test_session, phone="+2348090000004")
    material = MaterialCategory(slug="aluminum", name="Aluminum", price_per_kg_naira=700)
    test_session.add(material)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "estimated_weight_kg": 3,
            "auto_dispatch": False,
        },
        headers=headers,
    )
    listing_id = resp.json()["id"]

    listing_resp = await client.get("/api/v1/listings")
    assert listing_resp.status_code == 200
    assert any(item["id"] == listing_id for item in listing_resp.json())

    one = await client.get(f"/api/v1/listings/{listing_id}")
    assert one.status_code == 200
    assert one.json()["id"] == listing_id
