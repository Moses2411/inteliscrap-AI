import pytest
from sqlalchemy import select

from app.core import security
from app.models import Listing, MaterialCategory, Pickup, User, UserRole


async def _seller_headers(test_session, phone="+2348090000001"):
    user = User(id=f"auth-{phone}", phone_number=phone, role=UserRole.seller)
    test_session.add(user)
    await test_session.flush()
    token = security.create_access_token(user.id, UserRole.seller.value)
    return {"Authorization": f"Bearer {token}"}, user


async def _collector_headers(test_session, phone="+2348090000010", *, lat=None, lng=None):
    user = User(
        id=f"auth-{phone}",
        phone_number=phone,
        role=UserRole.collector,
        latitude=lat,
        longitude=lng,
        is_active=True,
    )
    test_session.add(user)
    await test_session.flush()
    token = security.create_access_token(user.id, UserRole.collector.value)
    return {"Authorization": f"Bearer {token}"}, user


@pytest.mark.asyncio
async def test_create_listing_dispatches(client, test_session):
    headers, seller = await _seller_headers(test_session)
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
    headers, _ = await _seller_headers(test_session, phone="+2348090000003")
    resp = await client.post(
        "/api/v1/listings",
        json={"material_category_id": 99999},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_and_get_listing(client, test_session):
    headers, seller = await _seller_headers(test_session, phone="+2348090000004")
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

    # The market board is collector-only.
    collector_headers, _ = await _collector_headers(test_session)
    listing_resp = await client.get("/api/v1/listings", headers=collector_headers)
    assert listing_resp.status_code == 200
    assert any(item["id"] == listing_id for item in listing_resp.json())

    one = await client.get(f"/api/v1/listings/{listing_id}", headers=collector_headers)
    assert one.status_code == 200
    assert one.json()["id"] == listing_id

    # The seller sees their own listing through /mine, not the market board.
    mine = await client.get("/api/v1/listings/mine", headers=headers)
    assert mine.status_code == 200
    assert [item["id"] for item in mine.json()] == [listing_id]


@pytest.mark.asyncio
async def test_market_board_is_collector_only(client, test_session):
    seller_headers, _ = await _seller_headers(test_session, phone="+2348090000020")

    anon = await client.get("/api/v1/listings")
    assert anon.status_code == 401

    forbidden = await client.get("/api/v1/listings", headers=seller_headers)
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_accept_listing_creates_pickup(client, test_session):
    seller_headers, _ = await _seller_headers(test_session, phone="+2348090000021")
    material = MaterialCategory(slug="copper", name="Copper", price_per_kg_naira=3200)
    test_session.add(material)
    await test_session.flush()

    created = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "estimated_weight_kg": 4,
            "latitude": 11.0,
            "longitude": 7.0,
            "auto_dispatch": False,
        },
        headers=seller_headers,
    )
    listing_id = created.json()["id"]

    collector_headers, collector = await _collector_headers(
        test_session, phone="+2348090000022", lat=11.01, lng=7.01
    )
    accepted = await client.post(
        f"/api/v1/listings/{listing_id}/accept", headers=collector_headers
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "scheduled"

    pickup = (
        await test_session.execute(select(Pickup).where(Pickup.listing_id == listing_id))
    ).scalars().one()
    assert pickup.collector_id == collector.id
    assert pickup.status.value == "accepted"
    assert pickup.distance_m is not None

    jobs = await client.get("/api/v1/pickups/active", headers=collector_headers)
    assert jobs.status_code == 200
    assert any(job["listing_id"] == listing_id for job in jobs.json())

    # A second collector cannot claim the same listing.
    other_headers, _ = await _collector_headers(test_session, phone="+2348090000023")
    conflict = await client.post(
        f"/api/v1/listings/{listing_id}/accept", headers=other_headers
    )
    assert conflict.status_code == 409


@pytest.mark.asyncio
async def test_create_listing_persists_weight_and_derives_value(client, test_session):
    """USSD/SMS offers read estimated_weight_kg; a dropped field shows "0kg".

    The field was accepted by clients but never declared on ListingCreate, so
    Pydantic silently discarded it and every feature-phone offer read 0kg.
    """
    headers, _ = await _seller_headers(test_session, phone="+2348090000030")
    material = MaterialCategory(slug="copper", name="Copper", price_per_kg_naira=3200)
    test_session.add(material)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "estimated_weight_kg": 6.5,
            "auto_dispatch": False,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["estimated_weight_kg"] == 6.5
    # No value supplied: derived from weight x the material's per-kg price.
    assert data["estimated_value_naira"] == 20800.0

    stored = (
        await test_session.execute(select(Listing).where(Listing.id == data["id"]))
    ).scalar_one()
    assert float(stored.estimated_weight_kg) == 6.5


@pytest.mark.asyncio
async def test_create_listing_keeps_supplied_value(client, test_session):
    headers, _ = await _seller_headers(test_session, phone="+2348090000031")
    material = MaterialCategory(slug="glass", name="Glass", price_per_kg_naira=300)
    test_session.add(material)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "estimated_weight_kg": 10,
            "estimated_value_naira": 1234,
            "auto_dispatch": False,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["estimated_value_naira"] == 1234.0


@pytest.mark.asyncio
async def test_create_listing_rejects_non_positive_weight(client, test_session):
    headers, _ = await _seller_headers(test_session, phone="+2348090000032")
    material = MaterialCategory(slug="steel", name="Steel", price_per_kg_naira=450)
    test_session.add(material)
    await test_session.flush()

    resp = await client.post(
        "/api/v1/listings",
        json={"material_category_id": material.id, "estimated_weight_kg": 0},
        headers=headers,
    )
    assert resp.status_code == 422
