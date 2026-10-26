import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import (
    Listing,
    MaterialCategory,
    Pickup,
    PickupStatus,
    SyncOutbox,
    User,
    UserRole,
)
from app.services import user_service

COLLECTOR_PHONE = "+2348030000001"


async def _seed_offer(test_session):
    collector = User(
        id="ussd-collector",
        phone_number=COLLECTOR_PHONE,
        role=UserRole.collector,
    )
    seller = User(
        id="ussd-seller",
        phone_number="+2348030000002",
        role=UserRole.seller,
    )
    material = MaterialCategory(slug="aluminum", name="Aluminum", price_per_kg_naira=700)
    test_session.add_all([collector, seller, material])
    await test_session.flush()

    listing = Listing(
        id="ussd-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=3,
        estimated_value_naira=2100,
        latitude=11.0,
        longitude=7.0,
        address_text="Gidan Musa, Samaru",
    )
    offer = Pickup(
        id="ussd-offer",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.offered,
        distance_m=100,
    )
    test_session.add_all([listing, offer])
    await test_session.flush()
    return collector, listing, offer


async def _ussd(client: AsyncClient, text: str):
    return await client.post(
        "/api/v1/ussd/callback",
        data={
            "sessionId": "ussd-session-1",
            "serviceCode": "*384*123#",
            "phoneNumber": COLLECTOR_PHONE,
            "text": text,
        },
    )


@pytest.mark.asyncio
async def test_ussd_unregistered_offers_registration(client):
    resp = await client.post(
        "/api/v1/ussd/callback",
        data={
            "sessionId": "s",
            "serviceCode": "*384*123#",
            "phoneNumber": "+2348099999999",
            "text": "",
        },
    )
    assert resp.status_code == 200
    assert resp.text.startswith("CON")
    assert "rijista" in resp.text


@pytest.mark.asyncio
async def test_ussd_register_collector_with_hub(client, test_session):
    phone = "+2348099999999"
    reg = await client.post(
        "/api/v1/ussd/callback",
        data={"sessionId": "s1", "serviceCode": "*384*123#", "phoneNumber": phone, "text": ""},
    )
    assert "rijista" in reg.text

    hub = await client.post(
        "/api/v1/ussd/callback",
        data={"sessionId": "s1", "serviceCode": "*384*123#", "phoneNumber": phone, "text": "1"},
    )
    assert "Samaru" in hub.text

    done = await client.post(
        "/api/v1/ussd/callback",
        data={"sessionId": "s1", "serviceCode": "*384*123#", "phoneNumber": phone, "text": "1*1"},
    )
    assert done.text.startswith("END")
    assert "rijista" in done.text

    user = await user_service.get_by_phone(test_session, phone)
    assert user is not None
    assert user.role == UserRole.collector
    assert user.latitude is not None
    assert user.longitude is not None
    assert user.h3_cell is not None
    # Hub coordinates are an area fallback, not a GPS fix.
    assert user.location_hub == "Samaru"
    assert user.location_precision == "hub"


@pytest.mark.asyncio
async def test_ussd_change_location_from_hub(client, test_session):
    collector, _, _ = await _seed_offer(test_session)
    menu = await _ussd(client, "4")
    assert "Samaru" in menu.text

    done = await _ussd(client, "4*3")
    assert done.text.startswith("END")
    assert "Kongo" in done.text

    await test_session.refresh(collector)
    assert collector.latitude is not None
    assert collector.longitude is not None
    assert collector.h3_cell is not None
    assert collector.location_hub == "Kongo"


@pytest.mark.asyncio
async def test_ussd_main_menu(client, test_session):
    collector, _, _ = await _seed_offer(test_session)
    resp = await _ussd(client, "")
    assert resp.status_code == 200
    assert resp.text.startswith("CON")
    assert "Sabbin kaya" in resp.text


@pytest.mark.asyncio
async def test_ussd_list_offers(client, test_session):
    await _seed_offer(test_session)
    resp = await _ussd(client, "1")
    assert "Aluminum" in resp.text
    assert "3kg" in resp.text


@pytest.mark.asyncio
async def test_ussd_accept_offer(client, test_session):
    _, listing, offer = await _seed_offer(test_session)

    resp = await _ussd(client, "1*1*1")
    assert resp.text.startswith("END")
    assert "An karba" in resp.text

    await test_session.refresh(offer)
    await test_session.refresh(listing)
    assert offer.status == PickupStatus.accepted
    assert listing.status.value == "scheduled"

    outbox = await test_session.execute(
        select(SyncOutbox).where(SyncOutbox.aggregate_id == offer.id)
    )
    assert outbox.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_accept_locks_listing_for_other_collectors(client, test_session):
    first = User(
        id="other-collector-1",
        phone_number=COLLECTOR_PHONE,
        role=UserRole.collector,
    )
    second = User(
        id="other-collector-2",
        phone_number="+2348030000004",
        role=UserRole.collector,
    )
    seller = User(
        id="other-seller",
        phone_number="+2348030000005",
        role=UserRole.seller,
    )
    material = MaterialCategory(
        slug="copper", name="Copper", price_per_kg_naira=3200
    )
    test_session.add_all([first, second, seller, material])
    await test_session.flush()

    listing = Listing(
        id="other-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        latitude=11.0,
        longitude=7.0,
    )
    offer_first = Pickup(
        id="other-offer-1",
        listing_id=listing.id,
        collector_id=first.id,
        status=PickupStatus.offered,
        distance_m=50,
    )
    offer_second = Pickup(
        id="other-offer-2",
        listing_id=listing.id,
        collector_id=second.id,
        status=PickupStatus.offered,
        distance_m=120,
    )
    test_session.add_all([listing, offer_first, offer_second])
    await test_session.flush()

    await _ussd(client, "1*1*1")

    await test_session.refresh(offer_first)
    await test_session.refresh(offer_second)
    await test_session.refresh(listing)
    assert offer_first.status == PickupStatus.accepted
    assert offer_second.status == PickupStatus.expired
    assert listing.status.value == "scheduled"

    from app.services.pickup_service import get_pending_offers

    remaining = await get_pending_offers(test_session, second)
    assert remaining == []


@pytest.mark.asyncio
async def test_ussd_never_reroles_an_existing_seller(client, test_session):
    """A seller dialling the USSD code must keep their account.

    Registration used to fall through to `existing.role = collector`, silently
    converting any non-collector who dialled in and orphaning their listings.
    """
    seller = User(
        id="ussd-existing-seller",
        phone_number="+2348030000077",
        role=UserRole.seller,
    )
    test_session.add(seller)
    await test_session.flush()
    before = (seller.role, seller.location_hub, seller.latitude)

    for text in ("", "1", "1*1"):
        resp = await client.post(
            "/api/v1/ussd/callback",
            data={
                "sessionId": "s-role",
                "serviceCode": "*384*123#",
                "phoneNumber": seller.phone_number,
                "text": text,
            },
        )
        assert resp.status_code == 200
        assert resp.text.startswith("END")
        assert "asusu" in resp.text

    await test_session.refresh(seller)
    assert seller.role == UserRole.seller
    # Nothing about the account was touched — no role flip, no hub reassignment.
    assert (seller.role, seller.location_hub, seller.latitude) == before


@pytest.mark.asyncio
async def test_ussd_offer_shows_weight_posted_through_the_app(client, test_session):
    """End-to-end: a listing posted with a weight must not read "0kg" on USSD.

    This is the pilot path — seller posts in the browser, collector dials in.
    """
    from app.core import security

    seller = User(
        id="e2e-seller",
        phone_number="+2348030000091",
        role=UserRole.seller,
    )
    collector = User(
        id="e2e-collector",
        phone_number="+2348030000092",
        role=UserRole.collector,
        latitude=11.0,
        longitude=7.0,
        is_active=True,
    )
    material = MaterialCategory(slug="copper", name="Copper", price_per_kg_naira=3200)
    test_session.add_all([seller, collector, material])
    await test_session.flush()

    token = security.create_access_token(seller.id, UserRole.seller.value)
    created = await client.post(
        "/api/v1/listings",
        json={
            "material_category_id": material.id,
            "estimated_weight_kg": 6.5,
            "latitude": 11.0,
            "longitude": 7.0,
            "auto_dispatch": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created.status_code == 201, created.text

    resp = await client.post(
        "/api/v1/ussd/callback",
        data={
            "sessionId": "e2e",
            "serviceCode": "*384*123#",
            "phoneNumber": collector.phone_number,
            "text": "1",
        },
    )
    assert "Copper" in resp.text
    assert "6.5kg" in resp.text
    assert "0kg" not in resp.text
