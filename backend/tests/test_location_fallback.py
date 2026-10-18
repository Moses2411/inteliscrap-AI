"""Area-based location fallback: hub presets + offline address gazetteer.

GPS is the primary location source. These tests cover the fallback used when a
collector or seller has no GPS fix: a hub/area or a known address is resolved to
an approximate centroid, dispatch still finds them, and the offer is labelled
with its (approximate) precision instead of pretending to be a real fix.
"""

import pytest

from app.core import security
from app.models import Listing, MaterialCategory, User, UserRole
from app.services import location_service, matching_service, user_service

# Samaru is both a hub preset and a gazetteer entry — a convenient anchor.
SAMARU_LAT = 11.1547
SAMARU_LON = 7.6478


def _headers(user: User) -> dict:
    return {"Authorization": f"Bearer {security.create_access_token(user.id, user.role.value)}"}


async def _add_user(test_session, uid, phone, role, lat=None, lng=None, **kwargs) -> User:
    user = User(
        id=uid,
        phone_number=phone,
        role=role,
        latitude=lat,
        longitude=lng,
        is_active=True,
        **kwargs,
    )
    test_session.add(user)
    await test_session.flush()
    return user


async def _material(test_session, slug) -> MaterialCategory:
    material = MaterialCategory(slug=slug, name=slug.title(), price_per_kg_naira=1000)
    test_session.add(material)
    await test_session.flush()
    return material


# ── Resolver unit tests (no database) ───────────────────────────────────


def test_hub_preset_resolves_with_hub_precision():
    resolved = location_service.resolve_fallback("Samaru", None)
    assert resolved == (SAMARU_LAT, SAMARU_LON, location_service.PRECISION_HUB)


def test_address_resolves_via_gazetteer():
    resolved = location_service.resolve_fallback(None, "12 Samaru Road, Zaria")
    assert resolved is not None
    lat, lng, precision = resolved
    assert precision == location_service.PRECISION_ADDRESS
    assert (lat, lng) == (SAMARU_LAT, SAMARU_LON)


def test_longest_place_name_wins():
    match = location_service.match_address("9 Kofar Gayan, Zaria City")
    assert match is not None
    assert match[0] == "kofar gayan"


def test_default_hub_alone_does_not_resolve():
    # "Zaria" is the column default, not an operational hub bubble.
    assert location_service.resolve_fallback("Zaria", None) is None


def test_unknown_area_has_no_fallback():
    assert location_service.resolve_fallback(None, "Nowhere in particular") is None


def test_approximate_precision_helper():
    assert location_service.is_approximate(location_service.PRECISION_HUB) is True
    assert location_service.is_approximate(location_service.PRECISION_ADDRESS) is True
    assert location_service.is_approximate(location_service.PRECISION_GPS) is False
    assert location_service.is_approximate(None) is False


# ── Collector fallback is matchable ─────────────────────────────────────


@pytest.mark.asyncio
async def test_collector_without_gps_is_reachable_by_area(client, test_session):
    seller = await _add_user(test_session, "lf-seller-1", "+2348130000001", UserRole.seller)
    # No coordinates at all — only an address the gazetteer understands.
    collector = await _add_user(
        test_session,
        "lf-collector-1",
        "+2348130000011",
        UserRole.collector,
        address_text="Samaru, Zaria",
    )
    material = await _material(test_session, "lf-copper")
    resp = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "latitude": SAMARU_LAT,
            "longitude": SAMARU_LON,
            "auto_dispatch": True,
        },
        headers=_headers(seller),
    )
    assert resp.status_code == 201, resp.text

    offers = (
        await client.get("/api/v1/pickups/offers", headers=_headers(collector))
    ).json()
    assert len(offers) == 1
    assert offers[0]["latitude"] == SAMARU_LAT


@pytest.mark.asyncio
async def test_signup_persists_hub_and_places_collector(client, test_session):
    phone = "+2348130000099"
    resp = await client.post(
        "/api/v1/auth/otp/request",
        json={
            "phone_number": phone,
            "role": "collector",
            "address_text": "Somewhere in Kongo",
            "location_hub": "Kongo",
        },
    )
    assert resp.status_code == 200, resp.text

    user = await user_service.get_by_phone(test_session, phone)
    assert user is not None
    # The chosen hub is persisted (it used to be silently dropped) and an
    # explicit hub outranks an address match.
    assert user.location_hub == "Kongo"
    assert user.latitude == pytest.approx(11.1113)
    assert user.longitude == pytest.approx(7.7227)
    assert user.location_precision == location_service.PRECISION_HUB


@pytest.mark.asyncio
async def test_signup_with_only_address_uses_gazetteer(client, test_session):
    phone = "+2348130000098"
    resp = await client.post(
        "/api/v1/auth/otp/request",
        json={
            "phone_number": phone,
            "role": "collector",
            "address_text": "12 Samaru Road, Zaria",
        },
    )
    assert resp.status_code == 200, resp.text

    user = await user_service.get_by_phone(test_session, phone)
    assert user is not None
    # No GPS, but the address puts them on the map as an approximate guess.
    assert user.latitude == pytest.approx(SAMARU_LAT)
    assert user.longitude == pytest.approx(SAMARU_LON)
    assert user.location_precision == location_service.PRECISION_ADDRESS


@pytest.mark.asyncio
async def test_unresolvable_collector_still_excluded(test_session):
    seller = await _add_user(test_session, "lf-seller-2", "+2348130000002", UserRole.seller)
    ghost = await _add_user(
        test_session,
        "lf-collector-2",
        "+2348130000012",
        UserRole.collector,
        address_text="Somewhere unknown",
    )
    material = await _material(test_session, "lf-steel")
    listing = Listing(
        id="lf-listing-2",
        seller_id=seller.id,
        material_category_id=material.id,
        latitude=SAMARU_LAT,
        longitude=SAMARU_LON,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(
        test_session, listing, radius_m=5000, limit=5
    )
    assert [o.collector_id for o in offers] == []
    assert ghost.latitude is None


# ── Radius widening for approximate locations ───────────────────────────


def _north(lat, meters):
    return lat + meters / matching_service.EARTH_RADIUS_M * (180.0 / 3.141592653589793)


@pytest.mark.asyncio
async def test_approx_seller_reaches_wider_radius(test_session):
    """A listing placed from an address widens the radius to find GPS collectors."""
    seller = await _add_user(test_session, "lf-seller-3", "+2348130000003", UserRole.seller)
    # ~7 km away: outside the default 5 km, inside the widened 7.5 km.
    far_lat = _north(SAMARU_LAT, 7000)
    collector = await _add_user(
        test_session,
        "lf-collector-3",
        "+2348130000013",
        UserRole.collector,
        lat=far_lat,
        lng=SAMARU_LON,
    )
    material = await _material(test_session, "lf-brass")
    # No GPS on the listing; resolve "Samaru" from the address instead.
    listing = Listing(
        id="lf-listing-3",
        seller_id=seller.id,
        material_category_id=material.id,
        address_text="Samaru, Zaria",
        latitude=SAMARU_LAT,
        longitude=SAMARU_LON,
        location_precision=location_service.PRECISION_ADDRESS,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(
        test_session, listing, radius_m=5000, limit=5
    )
    assert [o.collector_id for o in offers] == [collector.id]


@pytest.mark.asyncio
async def test_exact_seller_keeps_tight_radius(test_session):
    """The same 7 km collector is correctly excluded for a GPS-accurate listing."""
    seller = await _add_user(test_session, "lf-seller-4", "+2348130000004", UserRole.seller)
    far_lat = _north(SAMARU_LAT, 7000)
    await _add_user(
        test_session,
        "lf-collector-4",
        "+2348130000014",
        UserRole.collector,
        lat=far_lat,
        lng=SAMARU_LON,
    )
    material = await _material(test_session, "lf-zinc")
    listing = Listing(
        id="lf-listing-4",
        seller_id=seller.id,
        material_category_id=material.id,
        latitude=SAMARU_LAT,
        longitude=SAMARU_LON,
        location_precision=location_service.PRECISION_GPS,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(
        test_session, listing, radius_m=5000, limit=5
    )
    assert offers == []


# ── Ordering: prefer a real fix over a guessed area ─────────────────────


@pytest.mark.asyncio
async def test_exact_gps_match_ranks_before_area_fallback(test_session):
    seller = await _add_user(test_session, "lf-seller-5", "+2348130000005", UserRole.seller)
    await _add_user(
        test_session,
        "lf-gps-5",
        "+2348130000015",
        UserRole.collector,
        lat=SAMARU_LAT + 0.001,  # ~110 m north
        lng=SAMARU_LON,
        location_precision=location_service.PRECISION_GPS,
    )
    # Resolves to the exact listing anchor (distance ~0) but is only a guess.
    await _add_user(
        test_session,
        "lf-fallback-5",
        "+2348130000025",
        UserRole.collector,
        address_text="Samaru, Zaria",
    )
    material = await _material(test_session, "lf-glass")
    listing = Listing(
        id="lf-listing-5",
        seller_id=seller.id,
        material_category_id=material.id,
        latitude=SAMARU_LAT,
        longitude=SAMARU_LON,
        location_precision=location_service.PRECISION_GPS,
    )
    test_session.add(listing)
    await test_session.flush()

    offers = await matching_service.dispatch_listing(
        test_session, listing, radius_m=5000, limit=5
    )
    # The exact GPS fix is ranked first even though the area guess is "closer".
    assert [o.collector_id for o in offers] == ["lf-gps-5", "lf-fallback-5"]


# ── Listing creation from an address ────────────────────────────────────


@pytest.mark.asyncio
async def test_listing_without_gps_resolves_address_and_labels(client, test_session):
    seller = await _add_user(test_session, "lf-seller-6", "+2348130000006", UserRole.seller)
    material = await _material(test_session, "lf-glass2")
    resp = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "address_text": "12 Samaru Road, Zaria",
            "auto_dispatch": False,
        },
        headers=_headers(seller),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["latitude"] == SAMARU_LAT
    assert body["longitude"] == SAMARU_LON
    assert body["location_precision"] == location_service.PRECISION_ADDRESS
