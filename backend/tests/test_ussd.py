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
        role=UserRole.household,
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
async def test_ussd_unregistered_number(client):
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
    assert resp.text.startswith("END")


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
