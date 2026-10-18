import math

import pytest
from sqlalchemy import select

from app.config import settings
from app.models import (
    Listing,
    ListingStatus,
    MaterialCategory,
    Pickup,
    SyncOutbox,
    User,
    UserRole,
)
from app.services import matching_service

BASE_LAT = 11.0855
BASE_LON = 7.7195


async def _seed_collectors(test_session):
    near = User(
        id="matching-near",
        phone_number="+2348010000101",
        role=UserRole.collector,
        latitude=BASE_LAT,
        longitude=BASE_LON,
        is_active=True,
    )
    far = User(
        id="matching-far",
        phone_number="+2348010000102",
        role=UserRole.collector,
        latitude=BASE_LAT + 0.05,
        longitude=BASE_LON,
        is_active=True,
    )
    seller = User(
        id="matching-seller",
        phone_number="+2348010000103",
        role=UserRole.seller,
    )
    material = MaterialCategory(slug="copper", name="Copper", price_per_kg_naira=3200)
    test_session.add_all([near, far, seller, material])
    await test_session.flush()
    return seller, material


@pytest.mark.asyncio
async def test_haversine_zero_distance():
    assert matching_service.haversine_m(BASE_LAT, BASE_LON, BASE_LAT, BASE_LON) == 0


@pytest.mark.asyncio
async def test_haversine_positive_distance():
    d = matching_service.haversine_m(BASE_LAT, BASE_LON, BASE_LAT + 0.01, BASE_LON)
    assert 1000 < d < 1300


@pytest.mark.asyncio
@pytest.mark.skipif(matching_service.h3 is None, reason="h3 not installed")
async def test_latlng_to_h3_cell_consistent():
    c1 = matching_service.latlng_to_h3_cell(BASE_LAT, BASE_LON)
    c2 = matching_service.latlng_to_h3_cell(BASE_LAT, BASE_LON)
    c3 = matching_service.latlng_to_h3_cell(BASE_LAT, BASE_LON, resolution=7)
    assert c1 is not None
    assert c1 == c2
    assert c1 != c3


@pytest.mark.asyncio
@pytest.mark.skipif(matching_service.h3 is None, reason="h3 not installed")
async def test_h3_disk_includes_origin_and_neighbors():
    origin = matching_service.latlng_to_h3_cell(BASE_LAT, BASE_LON)
    assert origin is not None
    disk = await matching_service._h3_disk_cells(BASE_LAT, BASE_LON, radius_m=1500)
    assert origin in disk
    ring1 = matching_service.h3.grid_ring(origin, 1)
    assert ring1
    assert any(n in disk for n in ring1)


@pytest.mark.asyncio
async def test_h3_matching_orders_by_proximity_across_rings(test_session):
    seller = User(
        id="h3-seller", phone_number="+2348010000200", role=UserRole.seller
    )
    closer = User(
        id="h3-closer",
        phone_number="+2348010000201",
        role=UserRole.collector,
        latitude=BASE_LAT + 0.001,
        longitude=BASE_LON,
        is_active=True,
    )
    farther = User(
        id="h3-farther",
        phone_number="+2348010000202",
        role=UserRole.collector,
        latitude=BASE_LAT + 0.002,
        longitude=BASE_LON,
        is_active=True,
    )
    material = MaterialCategory(slug="brass", name="Brass", price_per_kg_naira=2200)
    test_session.add_all([seller, closer, farther, material])
    await test_session.flush()

    listing = Listing(
        id="h3-listing", seller_id=seller.id, material_category_id=material.id,
        latitude=BASE_LAT, longitude=BASE_LON,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(test_session, listing, radius_m=5000, limit=5)
    assert [o.collector_id for o in offers] == ["h3-closer", "h3-farther"]


@pytest.mark.asyncio
async def test_h3_matching_excludes_beyond_radius(test_session):
    seller = User(
        id="h3-seller2", phone_number="+2348010000210", role=UserRole.seller
    )
    far_away = User(
        id="h3-far2",
        phone_number="+2348010000211",
        role=UserRole.collector,
        latitude=BASE_LAT + 0.5,
        longitude=BASE_LON,
        is_active=True,
    )
    material = MaterialCategory(slug="steel", name="Steel", price_per_kg_naira=90)
    test_session.add_all([seller, far_away, material])
    await test_session.flush()

    listing = Listing(
        id="h3-listing2", seller_id=seller.id, material_category_id=material.id,
        latitude=BASE_LAT, longitude=BASE_LON,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(test_session, listing, radius_m=1000, limit=5)
    assert offers == []


@pytest.mark.asyncio
async def test_dispatch_nearest_first(test_session):
    seller, material = await _seed_collectors(test_session)
    listing = Listing(
        id="matching-listing-1",
        seller_id=seller.id,
        material_category_id=material.id,
        latitude=BASE_LAT,
        longitude=BASE_LON,
        estimated_weight_kg=5,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(test_session, listing, radius_m=100000, limit=5)

    assert len(offers) == 2
    assert offers[0].collector_id == "matching-near"
    assert offers[1].collector_id == "matching-far"
    assert offers[0].status.value == "offered"


@pytest.mark.asyncio
async def test_dispatch_respects_radius(test_session):
    seller, material = await _seed_collectors(test_session)
    listing = Listing(
        id="matching-listing-2",
        seller_id=seller.id,
        material_category_id=material.id,
        latitude=BASE_LAT,
        longitude=BASE_LON,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(test_session, listing, radius_m=1000, limit=5)
    assert [o.collector_id for o in offers] == ["matching-near"]


# ── Geospatial rigour ────────────────────────────────────────────────
# These cover the H3 bucketing, proximity ordering and radius boundaries
# end-to-end so a nearby collector is never silently dropped.


def _offset_point(lat: float, lon: float, north_m: float, east_m: float = 0.0):
    """A point approximately ``north_m``/``east_m`` metres from (lat, lon)."""
    dlat = math.degrees(north_m / matching_service.EARTH_RADIUS_M)
    dlon = math.degrees(
        east_m / (matching_service.EARTH_RADIUS_M * math.cos(math.radians(lat)))
    )
    return lat + dlat, lon + dlon


@pytest.mark.asyncio
@pytest.mark.skipif(matching_service.h3 is None, reason="h3 not installed")
async def test_h3_cell_uses_configured_resolution():
    cell = matching_service.latlng_to_h3_cell(BASE_LAT, BASE_LON)
    assert cell is not None
    assert matching_service.h3.get_resolution(cell) == settings.h3_resolution

    coarse = matching_service.latlng_to_h3_cell(BASE_LAT, BASE_LON, resolution=6)
    assert matching_service.h3.get_resolution(coarse) == 6


@pytest.mark.asyncio
@pytest.mark.skipif(matching_service.h3 is None, reason="h3 not installed")
async def test_h3_disk_grows_with_radius_and_caps_at_search_k():
    origin = matching_service.latlng_to_h3_cell(BASE_LAT, BASE_LON)
    small = await matching_service._h3_disk_cells(BASE_LAT, BASE_LON, radius_m=400)
    large = await matching_service._h3_disk_cells(BASE_LAT, BASE_LON, radius_m=4000)

    assert origin in small
    assert small <= large  # a bigger search radius never loses cells

    # A huge radius clamps to the configured ring cap rather than exploding.
    capped = await matching_service._h3_disk_cells(BASE_LAT, BASE_LON, radius_m=50_000_000)
    assert capped == set(matching_service.h3.grid_disk(origin, settings.h3_search_k))


@pytest.mark.asyncio
async def test_find_nearby_orders_and_respects_limit(test_session):
    users = [User(id="geo-lim-seller", phone_number="+2348170000000", role=UserRole.seller)]
    for i, uid in enumerate(["geo-c1", "geo-c2", "geo-c3"], start=1):
        users.append(
            User(
                id=uid,
                phone_number=f"+234817000000{uid[-1]}",
                role=UserRole.collector,
                latitude=BASE_LAT + 0.001 * i,
                longitude=BASE_LON,
                is_active=True,
            )
        )
    test_session.add_all(users)
    await test_session.flush()

    ranked = await matching_service.find_nearby_collectors(
        test_session, BASE_LAT, BASE_LON, radius_m=5000, limit=2
    )
    assert [u.id for u, _ in ranked] == ["geo-c1", "geo-c2"]
    # Distances are strictly ascending.
    assert ranked[0][1] < ranked[1][1]


@pytest.mark.asyncio
async def test_find_nearby_excludes_inactive_and_unlocated(test_session):
    inactive = User(
        id="geo-inactive",
        phone_number="+2348010000400",
        role=UserRole.collector,
        latitude=BASE_LAT,
        longitude=BASE_LON,
        is_active=False,
    )
    unlocated = User(
        id="geo-unlocated",
        phone_number="+2348010000401",
        role=UserRole.collector,
        is_active=True,
    )
    test_session.add_all([inactive, unlocated])
    await test_session.flush()

    ranked = await matching_service.find_nearby_collectors(
        test_session, BASE_LAT, BASE_LON, radius_m=5000, limit=10
    )
    ids = [u.id for u, _ in ranked]
    assert "geo-inactive" not in ids
    assert "geo-unlocated" not in ids


@pytest.mark.asyncio
async def test_stale_h3_cell_does_not_hide_nearby_collector(test_session):
    """A collector who moved is matched from their live coordinates, not a stale cell."""
    stale = User(
        id="geo-stale",
        phone_number="+2348010000410",
        role=UserRole.collector,
        latitude=BASE_LAT + 0.001,
        longitude=BASE_LON,
        is_active=True,
        # A bogus cell far from the listing — must be ignored.
        h3_cell="8888888888888fff",
    )
    test_session.add(stale)
    await test_session.flush()

    ranked = await matching_service.find_nearby_collectors(
        test_session, BASE_LAT, BASE_LON, radius_m=5000, limit=10
    )
    assert "geo-stale" in [u.id for u, _ in ranked]


@pytest.mark.asyncio
async def test_radius_boundary_includes_inside_excludes_outside(test_session):
    inside_lat, inside_lon = _offset_point(BASE_LAT, BASE_LON, 995)
    outside_lat, outside_lon = _offset_point(BASE_LAT, BASE_LON, 1005)
    inside = User(
        id="geo-inside",
        phone_number="+2348010000420",
        role=UserRole.collector,
        latitude=inside_lat,
        longitude=inside_lon,
        is_active=True,
    )
    outside = User(
        id="geo-outside",
        phone_number="+2348010000421",
        role=UserRole.collector,
        latitude=outside_lat,
        longitude=outside_lon,
        is_active=True,
    )
    test_session.add_all([inside, outside])
    await test_session.flush()

    ranked = await matching_service.find_nearby_collectors(
        test_session, BASE_LAT, BASE_LON, radius_m=1000, limit=10
    )
    ids = [u.id for u, _ in ranked]
    assert "geo-inside" in ids
    assert "geo-outside" not in ids


@pytest.mark.asyncio
async def test_dispatch_creates_one_offer_and_sms_per_collector(test_session):
    seller = User(
        id="geo-dispatch-seller",
        phone_number="+2348010000430",
        role=UserRole.seller,
    )
    material = MaterialCategory(slug="geo-zinc", name="Zinc", price_per_kg_naira=1500)
    near = User(
        id="geo-dispatch-near",
        phone_number="+2348010000431",
        role=UserRole.collector,
        latitude=BASE_LAT + 0.001,
        longitude=BASE_LON,
        is_active=True,
    )
    farther = User(
        id="geo-dispatch-far",
        phone_number="+2348010000432",
        role=UserRole.collector,
        latitude=BASE_LAT + 0.003,
        longitude=BASE_LON,
        is_active=True,
    )
    test_session.add_all([seller, material, near, farther])
    await test_session.flush()

    listing = Listing(
        id="geo-dispatch-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        latitude=BASE_LAT,
        longitude=BASE_LON,
        estimated_weight_kg=7,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(
        test_session, listing, material_name="Zinc", radius_m=5000, limit=5
    )
    assert [o.collector_id for o in offers] == ["geo-dispatch-near", "geo-dispatch-far"]
    assert listing.status == ListingStatus.matched

    sms = (
        await test_session.execute(
            select(SyncOutbox).where(
                SyncOutbox.aggregate_id == listing.id,
                SyncOutbox.event_type == "sms.new_offer",
            )
        )
    ).scalars().all()
    assert len(sms) == len(offers) == 2
    assert {m.payload["phone_number"] for m in sms} == {
        "+2348010000431",
        "+2348010000432",
    }
    assert all("Zinc" in m.payload["message"] for m in sms)


@pytest.mark.asyncio
async def test_dispatch_without_coordinates_returns_nothing(test_session):
    seller = User(id="geo-noloc-seller", phone_number="+2348010000440", role=UserRole.seller)
    material = MaterialCategory(slug="geo-tin", name="Tin", price_per_kg_naira=1100)
    test_session.add_all([seller, material])
    await test_session.flush()

    listing = Listing(
        id="geo-noloc-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        latitude=None,
        longitude=None,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(test_session, listing)
    assert offers == []

