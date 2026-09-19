import pytest

from app.models import Listing, MaterialCategory, Pickup, User, UserRole
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
        role=UserRole.household,
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
        id="h3-seller", phone_number="+2348010000200", role=UserRole.household
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
        id="h3-seller2", phone_number="+2348010000210", role=UserRole.household
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
