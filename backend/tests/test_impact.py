import pytest

from app.core import security
from app.models import Listing, MaterialCategory, Pickup, PickupStatus, User, UserRole
from app.services import settlement_service


async def _admin_headers(test_session) -> dict:
    admin = User(
        id="impact-admin",
        phone_number="+2348062000001",
        role=UserRole.admin,
        is_verified=True,
    )
    test_session.add(admin)
    await test_session.flush()
    token = security.create_access_token(admin.id, UserRole.admin.value)
    return {"Authorization": f"Bearer {token}"}


async def _settle_one(test_session, idx: int):
    seller = User(
        id=f"impact-seller-{idx}",
        phone_number=f"+234806000{idx:04d}",
        role=UserRole.household,
        location_hub="Zaria",
    )
    collector = User(
        id=f"impact-collector-{idx}",
        phone_number=f"+234806100{idx:04d}",
        role=UserRole.collector,
    )
    material = MaterialCategory(
        slug=f"copper-{idx}",
        name="Copper",
        price_per_kg_naira=3200,
        carbon_kg_co2e_per_kg=2.6,
    )
    test_session.add_all([seller, collector, material])
    await test_session.flush()

    listing = Listing(
        id=f"impact-listing-{idx}",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=5,
    )
    pickup = Pickup(
        id=f"impact-pickup-{idx}",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()
    await settlement_service.settle_pickup(test_session, pickup, weight_kg=5.0)


@pytest.mark.asyncio
async def test_impact_requires_auth(client):
    resp = await client.get("/api/v1/impact/summary")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_impact_summary(client, test_session):
    await _settle_one(test_session, 1)
    await _settle_one(test_session, 2)
    headers = await _admin_headers(test_session)

    resp = await client.get("/api/v1/impact/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["transactions_count"] == 2
    assert data["total_tonnage_kg"] == 10.0
    assert data["total_carbon_offset_kg_co2e"] == 26.0
    assert data["total_collector_income_naira"] == 30400.0


@pytest.mark.asyncio
async def test_impact_by_material(client, test_session):
    await _settle_one(test_session, 3)
    headers = await _admin_headers(test_session)
    resp = await client.get("/api/v1/impact/by-material", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["material"] == "Copper"
    assert data[0]["tonnage_kg"] == 5.0


@pytest.mark.asyncio
async def test_impact_daily(client, test_session):
    await _settle_one(test_session, 4)
    headers = await _admin_headers(test_session)
    resp = await client.get("/api/v1/impact/daily", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["tonnage_kg"] == 5.0
