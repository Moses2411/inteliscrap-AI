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
    # The collector must NOT receive the code — it belongs to the seller.
    assert "handover_pin" not in resp.json() or not resp.json().get("handover_pin")

    await test_session.refresh(offer)
    assert offer.pin_hash is not None
    assert offer.pin_cache is not None and len(offer.pin_cache) == 6
    assert offer.pin_hash != offer.pin_cache  # only the hash gates verification
    assert offer.confirm_deadline is not None
    assert offer.pin_expires_at is not None

    # The seller sees the code on their job board.
    board = await client.get(
        "/api/v1/pickups/awaiting-confirmation",
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    assert board.status_code == 200
    jobs = board.json()
    assert len(jobs) == 1
    assert jobs[0]["pickup_id"] == offer.id
    assert jobs[0]["handover_pin"] == offer.pin_cache
    assert jobs[0]["collector_phone"] == collector.phone_number


@pytest.mark.asyncio
async def test_collector_active_jobs_do_not_leak_code(client, test_session):
    seller, collector, _, _, _, offer = await _seed(test_session, "7")
    await client.post(
        f"/api/v1/pickups/{offer.id}/accept", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    active = await client.get(
        "/api/v1/pickups/active", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert active.status_code == 200
    assert active.json()[0]["handover_pin"] is None
    assert active.json()[0]["collector_phone"] is None


@pytest.mark.asyncio
async def test_collector_can_work_multiple_jobs_until_capacity(
    client, test_session, monkeypatch
):
    from app.services import pickup_service

    monkeypatch.setattr(pickup_service.settings, "collector_max_active_jobs", 2)
    seller, collector, _, material, _, offer = await _seed(test_session, "2")

    async def add_offer(tag: str) -> Pickup:
        listing = Listing(
            id=f"ho-listing-{tag}",
            seller_id=seller.id,
            material_category_id=material.id,
            status=ListingStatus.matched,
        )
        extra = Pickup(
            id=f"ho-offer-{tag}",
            listing_id=listing.id,
            collector_id=collector.id,
            status=PickupStatus.offered,
            distance_m=100,
        )
        test_session.add_all([listing, extra])
        await test_session.flush()
        return extra

    offer2 = await add_offer("b2")
    headers = {"Authorization": _token(collector, UserRole.collector)}

    # One active job does not pause the board: the collector can take another.
    first = await client.post(f"/api/v1/pickups/{offer.id}/accept", headers=headers)
    assert first.status_code == 200

    offers = await client.get("/api/v1/pickups/offers", headers=headers)
    assert offers.status_code == 200
    assert [row["pickup_id"] for row in offers.json()] == [offer2.id]

    hold = await client.get("/api/v1/pickups/hold", headers=headers)
    assert hold.status_code == 200
    assert hold.json()["on_hold"] is False
    assert hold.json()["active_jobs"] == 1
    assert hold.json()["max_concurrent_jobs"] == 2
    assert hold.json()["remaining_slots"] == 1
    assert hold.json()["open_handovers"] == 1

    second = await client.post(f"/api/v1/pickups/{offer2.id}/accept", headers=headers)
    assert second.status_code == 200

    # The last slot is taken: offers pause and a third accept is rejected.
    offer3 = await add_offer("b3")
    hold = await client.get("/api/v1/pickups/hold", headers=headers)
    assert hold.json()["on_hold"] is True
    assert hold.json()["active_jobs"] == 2
    assert hold.json()["remaining_slots"] == 0

    offers = await client.get("/api/v1/pickups/offers", headers=headers)
    assert offers.json() == []

    blocked = await client.post(f"/api/v1/pickups/{offer3.id}/accept", headers=headers)
    assert blocked.status_code == 409
    assert "limit" in blocked.json()["detail"].lower()

    # Recording a handover frees a slot immediately; the seller still holds
    # their listing until the code is confirmed.
    recorded = await client.post(
        f"/api/v1/pickups/{offer.id}/handover",
        json={"weight_kg": 5.0},
        headers=headers,
    )
    assert recorded.status_code == 200

    hold = await client.get("/api/v1/pickups/hold", headers=headers)
    assert hold.json()["on_hold"] is False
    assert hold.json()["active_jobs"] == 1
    assert hold.json()["remaining_slots"] == 1
    assert hold.json()["open_handovers"] == 2

    offers = await client.get("/api/v1/pickups/offers", headers=headers)
    assert [row["pickup_id"] for row in offers.json()] == [offer3.id]


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
    assert accepted.status_code == 200

    # The seller picks up the code from their board (the collector never sees it).
    board = await client.get(
        "/api/v1/pickups/awaiting-confirmation",
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    pin = board.json()[0]["handover_pin"]
    assert pin and len(pin) == 6

    # Collector records what was collected.
    handover = await client.post(
        f"/api/v1/pickups/{offer.id}/handover",
        json={"weight_kg": 5.0},
        headers={"Authorization": _token(collector, UserRole.collector)},
    )
    assert handover.status_code == 200
    assert handover.json()["status"] == PickupStatus.pending_confirmation.value

    # An unrelated user may not confirm.
    stranger = User(
        id="ho-stranger-4", phone_number="+2348109999994", role=UserRole.seller
    )
    test_session.add(stranger)
    await test_session.flush()
    wrong_user = await client.post(
        f"/api/v1/pickups/{offer.id}/confirm",
        json={"pin": pin},
        headers={"Authorization": _token(stranger, UserRole.seller)},
    )
    assert wrong_user.status_code == 403

    # Wrong code is rejected and counted (collector is the one entering it).
    bad = await client.post(
        f"/api/v1/pickups/{offer.id}/confirm",
        json={"pin": "000000"},
        headers={"Authorization": _token(collector, UserRole.collector)},
    )
    assert bad.status_code == 400
    await test_session.refresh(offer)
    assert offer.pin_attempts == 1

    # Correct code settles the pickup with the collector's recorded weight.
    ok = await client.post(
        f"/api/v1/pickups/{offer.id}/confirm",
        json={"pin": pin},
        headers={"Authorization": _token(collector, UserRole.collector)},
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
    assert hold.json()["active_jobs"] == 0


@pytest.mark.asyncio
async def test_seller_can_regenerate_code(client, test_session):
    seller, collector, _, _, _, offer = await _seed(test_session, "8")
    await client.post(
        f"/api/v1/pickups/{offer.id}/accept", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    board = await client.get(
        "/api/v1/pickups/awaiting-confirmation",
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    old_pin = board.json()[0]["handover_pin"]

    # Only the seller (or admin) may re-issue; the collector may not.
    denied = await client.post(
        f"/api/v1/pickups/{offer.id}/pin",
        headers={"Authorization": _token(collector, UserRole.collector)},
    )
    assert denied.status_code == 403

    regenerated = await client.post(
        f"/api/v1/pickups/{offer.id}/pin",
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    assert regenerated.status_code == 200
    new_pin = regenerated.json()["handover_pin"]
    assert new_pin != old_pin

    # The board reflects the fresh code.
    board2 = await client.get(
        "/api/v1/pickups/awaiting-confirmation",
        headers={"Authorization": _token(seller, UserRole.seller)},
    )
    assert board2.json()[0]["handover_pin"] == new_pin


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

    # Admin resolution leaves no active job holding the collector's slots.
    hold = await client.get(
        "/api/v1/pickups/hold", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert hold.json()["on_hold"] is False
    assert hold.json()["active_jobs"] == 0


@pytest.mark.asyncio
async def test_admin_disputes_requires_admin(client, test_session):
    _, collector, _, _, _, _ = await _seed(test_session, "6")
    resp = await client.get(
        "/api/v1/admin/disputes", headers={"Authorization": _token(collector, UserRole.collector)}
    )
    assert resp.status_code == 403

