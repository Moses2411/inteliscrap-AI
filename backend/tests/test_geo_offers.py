"""End-to-end checks that a seller's pickup location — and, only when the
seller allows it, their phone number — reaches the nearest collector through
the dispatched offers board.

A dedicated base point keeps this file isolated from the other suites' fixtures.
"""

import pytest
from sqlalchemy import select

from app.core import security
from app.models import MaterialCategory, Pickup, User, UserRole

GEO_LAT = 13.0000
GEO_LON = 9.0000


def _headers(user: User) -> dict:
    return {"Authorization": f"Bearer {security.create_access_token(user.id, user.role.value)}"}


async def _add_user(test_session, uid, phone, role, lat=None, lng=None) -> User:
    user = User(
        id=uid,
        phone_number=phone,
        role=role,
        latitude=lat,
        longitude=lng,
        is_active=True,
    )
    test_session.add(user)
    await test_session.flush()
    return user


async def _material(test_session, slug) -> MaterialCategory:
    material = MaterialCategory(slug=slug, name=slug.title(), price_per_kg_naira=1000)
    test_session.add(material)
    await test_session.flush()
    return material


async def _create_listing(client, seller, material, **overrides) -> dict:
    payload = {
        "material_category_id": material.id,
        "estimated_weight_kg": 4,
        "latitude": GEO_LAT,
        "longitude": GEO_LON,
        "auto_dispatch": True,
    }
    payload.update(overrides)
    resp = await client.post(
        "/api/v1/listings", json=payload, headers=_headers(seller)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _offers(client, collector) -> list[dict]:
    resp = await client.get("/api/v1/pickups/offers", headers=_headers(collector))
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_nearest_buyer_sees_location_and_shared_phone(client, test_session):
    seller = await _add_user(
        test_session, "geoapi-seller-1", "+2348120000001", UserRole.seller
    )
    near = await _add_user(
        test_session,
        "geoapi-near-1",
        "+2348120000011",
        UserRole.collector,
        GEO_LAT + 0.001,
        GEO_LON,
    )
    material = await _material(test_session, "geoapi-copper")
    listing = await _create_listing(
        client,
        seller,
        material,
        address_text="12 Samaru Road, Zaria",
        contact_phone="+2348120000099",
    )

    offers = await _offers(client, near)
    assert len(offers) == 1
    offer = offers[0]
    assert offer["listing_id"] == listing["id"]
    assert offer["address_text"] == "12 Samaru Road, Zaria"
    assert offer["latitude"] == GEO_LAT
    assert offer["longitude"] == GEO_LON
    assert offer["distance_m"] is not None and 0 < offer["distance_m"] < 1000
    # The seller opted in, so the nearest collector sees the phone.
    assert offer["contact_phone"] == "+2348120000099"
    assert offer["contact_shared"] is True


@pytest.mark.asyncio
async def test_location_visible_but_phone_hidden_without_opt_in(client, test_session):
    seller = await _add_user(
        test_session, "geoapi-seller-2", "+2348120000002", UserRole.seller
    )
    near = await _add_user(
        test_session,
        "geoapi-near-2",
        "+2348120000012",
        UserRole.collector,
        GEO_LAT + 0.001,
        GEO_LON,
    )
    material = await _material(test_session, "geoapi-aluminum")
    await _create_listing(
        client,
        seller,
        material,
        address_text="9 Kofar Gayan, Zaria",
        # No contact_phone → the seller did not allow sharing.
    )

    offers = await _offers(client, near)
    assert len(offers) == 1
    offer = offers[0]
    # Location is always visible to the nearest collector…
    assert offer["latitude"] == GEO_LAT
    assert offer["longitude"] == GEO_LON
    assert offer["address_text"] == "9 Kofar Gayan, Zaria"
    # …but the phone stays hidden unless the seller opted in.
    assert offer["contact_phone"] is None
    assert offer["contact_shared"] is False


@pytest.mark.asyncio
async def test_far_collector_receives_no_offer_and_no_location(client, test_session):
    seller = await _add_user(
        test_session, "geoapi-seller-3", "+2348120000003", UserRole.seller
    )
    far = await _add_user(
        test_session,
        "geoapi-far-3",
        "+2348120000013",
        UserRole.collector,
        GEO_LAT + 0.5,  # ~55 km away, well outside the 5 km dispatch radius
        GEO_LON,
    )
    material = await _material(test_session, "geoapi-steel")
    await _create_listing(
        client,
        seller,
        material,
        address_text="1 Far Place",
        contact_phone="+2348120000099",
    )

    assert await _offers(client, far) == []


@pytest.mark.asyncio
async def test_offers_are_ordered_by_proximity(client, test_session):
    seller = await _add_user(
        test_session, "geoapi-seller-4", "+2348120000004", UserRole.seller
    )
    near = await _add_user(
        test_session,
        "geoapi-near-4",
        "+2348120000014",
        UserRole.collector,
        GEO_LAT + 0.001,
        GEO_LON,
    )
    farther = await _add_user(
        test_session,
        "geoapi-far-4",
        "+2348120000024",
        UserRole.collector,
        GEO_LAT + 0.004,
        GEO_LON,
    )
    material = await _material(test_session, "geoapi-brass")
    listing = await _create_listing(client, seller, material)

    near_offer = (await _offers(client, near))[0]
    far_offer = (await _offers(client, farther))[0]
    assert near_offer["listing_id"] == listing["id"]
    assert far_offer["listing_id"] == listing["id"]
    assert near_offer["distance_m"] < far_offer["distance_m"]

    # Exactly the two in-range collectors were written as offers.
    rows = (
        await test_session.execute(
            select(Pickup).where(Pickup.listing_id == listing["id"])
        )
    ).scalars().all()
    assert {r.collector_id for r in rows} == {"geoapi-near-4", "geoapi-far-4"}


@pytest.mark.asyncio
async def test_market_board_reflects_phone_opt_in(client, test_session):
    seller = await _add_user(
        test_session, "geoapi-seller-5", "+2348120000005", UserRole.seller
    )
    browser = await _add_user(
        test_session,
        "geoapi-browser-5",
        "+2348120000015",
        UserRole.collector,
        GEO_LAT + 0.002,
        GEO_LON,
    )
    material = await _material(test_session, "geoapi-glass")

    shared = await _create_listing(
        client, seller, material, contact_phone="+2348120000098", auto_dispatch=False
    )
    hidden = await _create_listing(client, seller, material, auto_dispatch=False)

    resp = await client.get("/api/v1/listings", headers=_headers(browser))
    assert resp.status_code == 200
    by_id = {item["id"]: item for item in resp.json()}
    assert by_id[shared["id"]]["contact_phone"] == "+2348120000098"
    assert by_id[hidden["id"]]["contact_phone"] is None
    # The pickup location is on the board either way.
    assert by_id[hidden["id"]]["latitude"] == GEO_LAT
