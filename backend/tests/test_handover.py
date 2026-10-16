from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.core import security
from app.models import (
    Listing,
    ListingStatus,
    MaterialCategory,
    Pickup,
    PickupStatus,
    User,
    UserRole,
)


def _token(user: User, role: UserRole) -> str:
    return f"Bearer {security.create_access_token(user.id, role.value)}"


async def _seed(test_session, tag: str):
    base = int(tag)
    seller = User(
        id=f"ho-seller-{tag}",
        phone_number=f"+2348100{base:05d}",
        role=UserRole.seller,
        location_hub="Zaria",
    )
    collector = User(
        id=f"ho-collector-{tag}",
        phone_number=f"+2348101{base:05d}",
        role=UserRole.collector,
        latitude=11.0,
        longitude=7.0,
    )
    admin = User(
        id=f"ho-admin-{tag}",
        phone_number=f"+2348102{base:05d}",
        role=UserRole.admin,
    )
    material = MaterialCategory(
        slug=f"copper-{tag}", name="Copper", price_per_kg_naira=3200, carbon_kg_co2e_per_kg=2.6
    )
    test_session.add_all([seller, collector, admin, material])
    await test_session.flush()

    listing = Listing(
        id=f"ho-listing-{tag}",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=5,
        estimated_value_naira=16000,
        latitude=11.0,
        longitude=7.0,
        address_text="Gidan Musa, Samaru",
        contact_phone="+2348012345678",
        status=ListingStatus.matched,
    )
    offer = Pickup(
        id=f"ho-offer-{tag}",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.offered,
        distance_m=100,
    )
    other = Pickup(
        id=f"ho-other-{tag}",
        listing_id=listing.id,
        collector_id=None,
        status=PickupStatus.offered,
        distance_m=200,
    )
    test_session.add_all([listing, offer, other])
    await test_session.flush()
    return seller, collector, admin, material, listing, offer


@pytest.mark.asyncio
async def test_accept_issues_pin_and_sets_deadline(client, test_session):
    seller, collector, _, _, _, offer = await _seed(test_session, "1")
    resp = await client.post(
        f"/api/v1/pickups/{offer.id}/accept", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["handover_pin"]) == 6
    assert data["handover_pin"].isdigit()

    await test_session.refresh(offer)
    assert offer.pin_hash is not None
    assert offer.pin_hash != data["handover_pin"]  # only the hash is stored
    assert offer.confirm_deadline is not None
    assert offer.pin_expires_at is not None


@pytest.mark.asyncio
async def test_collector_hold_blocks_new_offers_and_accepts(client, test_session):
    seller, collector, _, _, _, offer = await _seed(test_session, "2")
    await client.post(
        f"/api/v1/pickups/{offer.id}/accept", headers={"Authorization": _token(collector, UserRole.collector)}
    )

    # A fresh offer arrives for the same collector while the handover is open.
    material = MaterialCategory(slug="hold-b", name="Lead", price_per_kg_naira=200)
    test_session.add(material)
    await test_session.flush()
    listing2 = Listing(
        id="ho-listing-b2",
        seller_id=seller.id,
        material_category_id=material.id,
        status=ListingStatus.matched,
    )
    offer2 = Pickup(
        id="ho-offer-b2",
        listing_id=listing2.id,
        collector_id=collector.id,
        status=PickupStatus.offered,
    )
    test_session.add_all([listing2, offer2])
    await test_session.flush()

    offers = await client.get(
        "/api/v1/pickups/offers", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert offers.status_code == 200
    assert offers.json() == []

    hold = await client.get(
        "/api/v1/pickups/hold", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert hold.status_code == 200
    assert hold.json()["on_hold"] is True
    assert hold.json()["open_handovers"] == 1

    blocked = await client.post(
        f"/api/v1/pickups/{offer2.id}/accept",
        headers={"Authorization": _token(collector, UserRole.collector)},
    )
    assert blocked.status_code == 409


@pytest.mark.asyncio
async def test_seller_hold_blocks_new_listings(client, test_session):
    seller, collector, _, material, _, offer = await _seed(test_session, "3")
    await client.post(
        f"/api/v1/pickups/{offer.id}/accept", headers={"Authorization": _token(collector, UserRole.collector)}
    )

    resp = await client.post(
        "/api/v1/listings",
        json={"material_category_id": material.id, "estimated_weight_kg": 1, "auto_dispatch": False},
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    assert resp.status_code == 409
    assert "handover" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_full_handover_confirm_flow_releases_holds(client, test_session):
    seller, collector, _, material, listing, offer = await _seed(test_session, "4")
    accepted = await client.post(
        f"/api/v1/pickups/{offer.id}/accept", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    pin = accepted.json()["handover_pin"]

    # Collector records what was collected.
    handover = await client.post(
        f"/api/v1/pickups/{offer.id}/handover",
        json={"weight_kg": 5.0},
        headers={"Authorization": _token(collector, UserRole.collector)},
    )
    assert handover.status_code == 200
    assert handover.json()["status"] == PickupStatus.pending_confirmation.value

    # Only the seller may confirm.
    wrong_user = await client.post(
        f"/api/v1/pickups/{offer.id}/confirm",
        json={"pin": pin},
        headers={"Authorization": _token(collector, UserRole.collector)},
    )
    assert wrong_user.status_code == 403

    # Wrong PIN is rejected and counted.
    bad = await client.post(
        f"/api/v1/pickups/{offer.id}/confirm",
        json={"pin": "000000"},
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    assert bad.status_code == 400
    await test_session.refresh(offer)
    assert offer.pin_attempts == 1

    # Correct PIN settles the pickup with the collector's recorded weight.
    ok = await client.post(
        f"/api/v1/pickups/{offer.id}/confirm",
        json={"pin": pin},
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    assert ok.status_code == 200
    txn = ok.json()
    assert txn["status"] == "settled"
    assert txn["weight_kg"] == 5.0
    assert txn["gross_value_naira"] == 16000.0

    await test_session.refresh(offer)
    assert offer.status == PickupStatus.completed
    assert offer.confirmed_at is not None
    await test_session.refresh(listing)
    assert listing.status == ListingStatus.completed

    # Holds released: seller can list again, collector sees offers again.
    create = await client.post(
        "/api/v1/listings",
        json={"material_category_id": material.id, "estimated_weight_kg": 1, "auto_dispatch": False},
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    assert create.status_code == 201

    hold = await client.get(
        "/api/v1/pickups/hold", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert hold.json()["on_hold"] is False


@pytest.mark.asyncio
async def test_overdue_handover_escalates_and_admin_resolves(client, test_session):
    seller, collector, admin, _, listing, offer = await _seed(test_session, "5")
    await client.post(
        f"/api/v1/pickups/{offer.id}/accept", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    await client.post(
        f"/api/v1/pickups/{offer.id}/handover",
        json={"weight_kg": 4.0},
        headers={"Authorization": _token(collector, UserRole.collector)},
    )

    # Simulate the 4h window elapsing.
    offer.confirm_deadline = datetime.utcnow() - timedelta(minutes=1)
    await test_session.flush()

    disputes = await client.get(
        "/api/v1/admin/disputes", headers={"Authorization": _token(admin, UserRole.admin)}
    )
    assert disputes.status_code == 200
    body = disputes.json()
    assert [d["pickup_id"] for d in body] == [offer.id]
    assert body[0]["status"] == PickupStatus.disputed.value
    assert body[0]["seller_phone"] == seller.phone_number

    resolved = await client.post(
        f"/api/v1/admin/pickups/{offer.id}/resolve",
        json={"resolution": "cancel", "reason": "not collected"},
        headers={"Authorization": _token(admin, UserRole.admin)},
    )
    assert resolved.status_code == 200
    assert resolved.json()["pickup_status"] == PickupStatus.cancelled.value

    await test_session.refresh(offer)
    assert offer.status == PickupStatus.cancelled
    await test_session.refresh(listing)
    assert listing.status == ListingStatus.cancelled

    # Admin resolution released the collector's hold.
    hold = await client.get(
        "/api/v1/pickups/hold", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert hold.json()["on_hold"] is False


@pytest.mark.asyncio
async def test_admin_disputes_requires_admin(client, test_session):
    _, collector, _, _, _, _ = await _seed(test_session, "6")
    resp = await client.get(
        "/api/v1/admin/disputes", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert resp.status_code == 403

