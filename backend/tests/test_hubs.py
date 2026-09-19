import pytest
from sqlalchemy import select

from app.core import security
from app.models import (
    CompliancePartner,
    HubDelivery,
    HubRecyclingRequest,
    Listing,
    MaterialCategory,
    NGOImpactLog,
    Pickup,
    PickupStatus,
    RecyclingHub,
    User,
    UserRole,
)
from app.services import settlement_service


async def _seed_hub(test_session):
    seller = User(
        id="hub-seller",
        phone_number="+2348060000001",
        role=UserRole.household,
        location_hub="GreenCycle Hub",
    )
    hub_owner = User(
        id="hub-owner",
        phone_number="+2348060000002",
        role=UserRole.household,
        location_hub="Zaria",
    )
    collector = User(
        id="hub-collector",
        phone_number="+2348060000003",
        role=UserRole.collector,
    )
    material = MaterialCategory(
        slug="copper", name="Copper", price_per_kg_naira=3200, carbon_kg_co2e_per_kg=2.6
    )
    test_session.add_all([seller, hub_owner, collector, material])
    await test_session.flush()

    hub = RecyclingHub(
        owner_user_id=hub_owner.id,
        name="GreenCycle Hub",
        city="Zaria",
        contact_phone="+2348060000010",
    )
    test_session.add(hub)
    await test_session.flush()

    return seller, hub_owner, collector, material, hub


# ── Hub Registration ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_hub(client, test_session):
    user = User(
        id="reg-owner",
        phone_number="+2348060000020",
        role=UserRole.household,
        location_hub="Zaria",
    )
    test_session.add(user)
    await test_session.flush()
    token = security.create_access_token("reg-owner", UserRole.household.value)
    resp = await client.post(
        "/api/v1/hubs/register",
        json={
            "name": "EcoCycle Hub",
            "city": "Kano",
            "contact_phone": "+2348060000011",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "EcoCycle Hub"
    assert data["city"] == "Kano"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_register_hub_conflict(client, test_session):
    await _seed_hub(test_session)
    token = security.create_access_token("hub-owner", UserRole.household.value)
    resp = await client.post(
        "/api/v1/hubs/register",
        json={"name": "Duplicate Hub", "city": "Zaria"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_hubs(client, test_session):
    await _seed_hub(test_session)
    resp = await client.get("/api/v1/hubs/")
    assert resp.status_code == 200
    names = [h["name"] for h in resp.json()]
    assert "GreenCycle Hub" in names


# ── Hub Requests ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_hub_request(client, test_session):
    _, _, _, material, hub = await _seed_hub(test_session)
    token = security.create_access_token("hub-owner", UserRole.recycling_hub.value)
    resp = await client.post(
        "/api/v1/hubs/requests",
        json={
            "material_category_id": material.id,
            "requested_kg": 50.0,
            "note": "Urgent copper needed",
            "requested_on": "2026-09-08T00:00:00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["material_name"] == "Copper"
    assert data["requested_kg"] == 50.0
    assert data["fulfilled_kg"] == 0.0
    assert data["status"] == "open"


@pytest.mark.asyncio
async def test_list_hub_requests(client, test_session):
    _, _, _, material, hub = await _seed_hub(test_session)
    token = security.create_access_token("hub-owner", UserRole.recycling_hub.value)
    await client.post(
        "/api/v1/hubs/requests",
        json={
            "material_category_id": material.id,
            "requested_kg": 30.0,
            "requested_on": "2026-09-08T00:00:00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/v1/hubs/requests",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["requested_kg"] == 30.0


# ── Hub Subscription ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hub_subscribe(client, test_session):
    await _seed_hub(test_session)
    token = security.create_access_token("hub-owner", UserRole.recycling_hub.value)
    resp = await client.post(
        "/api/v1/hubs/subscribe",
        json={
            "plan_name": "Pro",
            "amount_naira": 50000,
            "payment_method": "cash",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan_name"] == "Pro"
    assert data["amount_naira"] == 50000.0
    assert data["status"] == "active"
    assert data["next_billing_at"] is not None


@pytest.mark.asyncio
async def test_list_hub_subscriptions(client, test_session):
    await _seed_hub(test_session)
    token = security.create_access_token("hub-owner", UserRole.recycling_hub.value)
    await client.post(
        "/api/v1/hubs/subscribe",
        json={"plan_name": "Pro", "amount_naira": 50000},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/v1/hubs/subscriptions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── Hub Delivery on Settlement ───────────────────────────────────────


@pytest.mark.asyncio
async def test_settle_with_explicit_hub_id_delivers(test_session):
    seller, hub_owner, collector, material, hub = await _seed_hub(test_session)
    req = HubRecyclingRequest(
        hub_id=hub.id,
        material_category_id=material.id,
        requested_kg=10.0,
        requested_on=__import__("datetime").date.today(),
    )
    test_session.add(req)
    await test_session.flush()

    listing = Listing(
        id="explicit-hub-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=6,
        estimated_value_naira=19200,
        latitude=11.0,
        longitude=7.0,
    )
    pickup = Pickup(
        id="explicit-hub-pickup",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()

    txn = await settlement_service.settle_pickup(
        test_session, pickup, weight_kg=6.0, hub_id=hub.id
    )
    delivery = (
        await test_session.execute(
            select(HubDelivery).where(HubDelivery.transaction_id == txn.id)
        )
    ).scalar_one()
    assert delivery.hub_id == hub.id
    assert delivery.request_id == req.id
    req_updated = await test_session.get(HubRecyclingRequest, req.id)
    assert float(req_updated.fulfilled_kg) == 6.0


@pytest.mark.asyncio
async def test_settle_records_hub_delivery(test_session):
    seller, hub_owner, collector, material, hub = await _seed_hub(test_session)

    req = HubRecyclingRequest(
        hub_id=hub.id,
        material_category_id=material.id,
        requested_kg=50.0,
        requested_on=__import__("datetime").date.today(),
        note="Today copper",
    )
    test_session.add(req)
    await test_session.flush()

    listing = Listing(
        id="hub-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=10,
        estimated_value_naira=32000,
        latitude=11.0,
        longitude=7.0,
    )
    pickup = Pickup(
        id="hub-pickup",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()

    txn = await settlement_service.settle_pickup(test_session, pickup, weight_kg=15.0)

    delivery = (
        await test_session.execute(
            select(HubDelivery).where(HubDelivery.transaction_id == txn.id)
        )
    ).scalar_one_or_none()
    assert delivery is not None
    assert delivery.hub_id == hub.id
    assert float(delivery.weight_kg) == 15.0

    req_updated = await test_session.get(HubRecyclingRequest, req.id)
    assert float(req_updated.fulfilled_kg) == 15.0
    assert req_updated.status == "open"

    impact = (
        await test_session.execute(
            select(NGOImpactLog).where(NGOImpactLog.transaction_id == txn.id)
        )
    ).scalar_one()
    assert impact.hub == "GreenCycle Hub"


@pytest.mark.asyncio
async def test_settle_fills_request_when_enough_kg(test_session):
    seller, hub_owner, collector, material, hub = await _seed_hub(test_session)

    req = HubRecyclingRequest(
        hub_id=hub.id,
        material_category_id=material.id,
        requested_kg=10.0,
        requested_on=__import__("datetime").date.today(),
    )
    test_session.add(req)
    await test_session.flush()

    listing = Listing(
        id="fill-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=12,
        estimated_value_naira=38400,
        latitude=11.0,
        longitude=7.0,
    )
    pickup = Pickup(
        id="fill-pickup",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()

    await settlement_service.settle_pickup(test_session, pickup, weight_kg=12.0)

    req_updated = await test_session.get(HubRecyclingRequest, req.id)
    assert float(req_updated.fulfilled_kg) == 12.0
    assert req_updated.status == "filled"


@pytest.mark.asyncio
async def test_hub_deliveries_endpoint(client, test_session):
    seller, hub_owner, collector, material, hub = await _seed_hub(test_session)

    req = HubRecyclingRequest(
        hub_id=hub.id,
        material_category_id=material.id,
        requested_kg=100.0,
        requested_on=__import__("datetime").date.today(),
    )
    test_session.add(req)
    await test_session.flush()

    listing = Listing(
        id="del-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=8,
        estimated_value_naira=25600,
        latitude=11.0,
        longitude=7.0,
    )
    pickup = Pickup(
        id="del-pickup",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()

    await settlement_service.settle_pickup(test_session, pickup, weight_kg=8.0)

    token = security.create_access_token("hub-owner", UserRole.recycling_hub.value)
    resp = await client.get(
        "/api/v1/hubs/deliveries",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["weight_kg"] == 8.0


# ── Compliance Manifesto ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_compliance_manifesto(client, test_session):
    seller, hub_owner, collector, material, hub = await _seed_hub(test_session)

    partner = CompliancePartner(
        name="EPRON Nigeria",
        partner_type="pro",
        api_key="epron-test-key-123",
    )
    test_session.add(partner)
    await test_session.flush()

    listing = Listing(
        id="comp-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=20,
        estimated_value_naira=64000,
        latitude=11.0,
        longitude=7.0,
    )
    pickup = Pickup(
        id="comp-pickup",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()

    await settlement_service.settle_pickup(test_session, pickup, weight_kg=20.0)

    resp = await client.get(
        "/api/v1/compliance/manifesto",
        headers={"X-API-Key": "epron-test-key-123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["partner_name"] == "EPRON Nigeria"
    assert data["partner_type"] == "pro"
    assert data["total_transactions"] == 1
    assert data["total_tonnage_kg"] == 20.0
    assert data["items"][0]["material_slug"] == "copper"
    assert data["items"][0]["hub"] == "GreenCycle Hub"


@pytest.mark.asyncio
async def test_compliance_manifesto_rejects_bad_key(client):
    resp = await client.get(
        "/api/v1/compliance/manifesto",
        headers={"X-API-Key": "invalid-key"},
    )
    assert resp.status_code == 401
