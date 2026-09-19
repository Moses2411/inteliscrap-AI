import pytest
from sqlalchemy import select

from app.core import security
from app.models import (
    Listing,
    ListingStatus,
    MaterialCategory,
    Pickup,
    PickupStatus,
    SyncOutbox,
    User,
    UserRole,
)


def _token(user: User, role: UserRole) -> str:
    return security.create_access_token(user.id, role.value)


async def _seed_offer(test_session, offer_id="pk-offer-1", phone="+2348060000001"):
    collector = User(
        id="pk-collector",
        phone_number=phone,
        role=UserRole.collector,
        latitude=11.0,
        longitude=7.0,
        is_active=True,
    )
    other = User(
        id="pk-collector-other",
        phone_number="+2348060000002",
        role=UserRole.collector,
        is_active=True,
    )
    seller = User(
        id="pk-seller",
        phone_number="+2348060000003",
        role=UserRole.household,
    )
    material = MaterialCategory(slug="aluminum", name="Aluminum", price_per_kg_naira=700)
    test_session.add_all([collector, other, seller, material])
    await test_session.flush()

    listing = Listing(
        id="pk-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=3,
        estimated_value_naira=2100,
        latitude=11.0,
        longitude=7.0,
        address_text="Gidan Musa, Samaru",
        contact_phone="+2348012345678",
        status=ListingStatus.matched,
    )
    offer = Pickup(
        id=offer_id,
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.offered,
        distance_m=100,
    )
    other_offer = Pickup(
        id="pk-offer-other",
        listing_id=listing.id,
        collector_id=other.id,
        status=PickupStatus.offered,
        distance_m=200,
    )
    test_session.add_all([listing, offer, other_offer])
    await test_session.flush()
    return collector, listing, offer


async def _collector_headers(test_session) -> dict:
    collector = User(
        id="pk-auth-collector",
        phone_number="+2348060000009",
        role=UserRole.collector,
        latitude=11.0,
        longitude=7.0,
        is_active=True,
    )
    test_session.add(collector)
    await test_session.flush()
    return {"Authorization": f"Bearer {_token(collector, UserRole.collector)}"}


@pytest.mark.asyncio
async def test_list_offers_returns_only_own(client, test_session):
    collector, _, offer = await _seed_offer(test_session)

    resp = await client.get(
        "/api/v1/pickups/offers",
        headers={"Authorization": f"Bearer {_token(collector, UserRole.collector)}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert [item["pickup_id"] for item in data] == [offer.id]
    assert data[0]["material_name"] == "Aluminum"
    assert data[0]["distance_m"] == 100


@pytest.mark.asyncio
async def test_list_offers_requires_collector_role(client, test_session):
    household = User(
        id="pk-household", phone_number="+2348060000010", role=UserRole.household
    )
    test_session.add(household)
    await test_session.flush()

    resp = await client.get(
        "/api/v1/pickups/offers",
        headers={"Authorization": f"Bearer {_token(household, UserRole.household)}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_accept_offer_returns_job_with_location_and_contact(client, test_session):
    collector, listing, offer = await _seed_offer(test_session)

    resp = await client.post(
        f"/api/v1/pickups/{offer.id}/accept",
        headers={"Authorization": f"Bearer {_token(collector, UserRole.collector)}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == PickupStatus.accepted.value
    assert data["latitude"] == 11.0
    assert data["contact_phone"] == "+2348012345678"
    assert data["material_name"] == "Aluminum"

    await test_session.refresh(listing)
    assert listing.status == ListingStatus.scheduled

    # The accepting collector gets the location + contact via SMS outbox.
    outbox = await test_session.execute(
        select(SyncOutbox).where(SyncOutbox.event_type == "sms.location")
    )
    payload = outbox.scalar_one().payload
    assert "+2348012345678" in payload["message"]


@pytest.mark.asyncio
async def test_accept_offer_expires_other_offers(client, test_session):
    collector, _, offer = await _seed_offer(test_session)

    await client.post(
        f"/api/v1/pickups/{offer.id}/accept",
        headers={"Authorization": f"Bearer {_token(collector, UserRole.collector)}"},
    )
    others = (
        await test_session.execute(
            select(Pickup).where(Pickup.id == "pk-offer-other")
        )
    ).scalars().all()
    assert others[0].status == PickupStatus.expired


@pytest.mark.asyncio
async def test_accept_expired_offer_is_conflict(client, test_session):
    collector, _, offer = await _seed_offer(test_session)
    offer.status = PickupStatus.expired
    await test_session.flush()

    resp = await client.post(
        f"/api/v1/pickups/{offer.id}/accept",
        headers={"Authorization": f"Bearer {_token(collector, UserRole.collector)}"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_active_pickups_lists_accepted(client, test_session):
    collector, _, offer = await _seed_offer(test_session)

    accepted = await client.post(
        f"/api/v1/pickups/{offer.id}/accept",
        headers={"Authorization": f"Bearer {_token(collector, UserRole.collector)}"},
    )
    assert accepted.status_code == 200

    resp = await client.get(
        "/api/v1/pickups/active",
        headers={"Authorization": f"Bearer {_token(collector, UserRole.collector)}"},
    )
    assert resp.status_code == 200
    assert [item["pickup_id"] for item in resp.json()] == [offer.id]


@pytest.mark.asyncio
async def test_dispatch_enqueues_new_offer_sms(client, test_session):
    material = MaterialCategory(slug="copper", name="Copper", price_per_kg_naira=3200)
    test_session.add(material)
    await test_session.flush()

    collector = User(
        id="pk-dispatch-collector",
        phone_number="+2348060000009",
        role=UserRole.collector,
        latitude=10.999,
        longitude=7.001,
        is_active=True,
    )
    test_session.add(collector)
    await test_session.flush()

    sell_head = User(
        id="pk-dispatch-seller",
        phone_number="+2348060000020",
        role=UserRole.household,
    )
    test_session.add(sell_head)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "estimated_weight_kg": 5,
            "latitude": 11.0,
            "longitude": 7.0,
        },
        headers={"Authorization": f"Bearer {_token(sell_head, UserRole.household)}"},
    )
    assert resp.status_code == 201

    outbox = await test_session.execute(
        select(SyncOutbox).where(SyncOutbox.event_type == "sms.new_offer")
    )
    items = outbox.scalars().all()
    assert len(items) == 1
    assert "Copper" in items[0].payload["message"]
    assert "+2348060000009" in items[0].payload["phone_number"]


@pytest.mark.asyncio
async def test_contact_phone_is_optional(client, test_session):
    material = MaterialCategory(slug="steel", name="Steel", price_per_kg_naira=90)
    test_session.add(material)
    await test_session.flush()

    sell_head = User(
        id="pk-opt-seller",
        phone_number="+2348060000030",
        role=UserRole.household,
    )
    test_session.add(sell_head)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "estimated_weight_kg": 2,
            "latitude": 11.0,
            "longitude": 7.0,
            "auto_dispatch": False,
        },
        headers={"Authorization": f"Bearer {_token(sell_head, UserRole.household)}"},
    )
    assert resp.status_code == 201
    assert resp.json()["contact_phone"] is None
