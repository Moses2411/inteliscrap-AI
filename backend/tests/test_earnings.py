import pytest

from app.core import security
from app.models import (
    Listing,
    ListingStatus,
    MaterialCategory,
    Pickup,
    PickupStatus,
    Transaction,
    User,
    UserRole,
)
from app.services import settlement_service


async def _settle_one(test_session, idx: int) -> tuple[User, User, Transaction]:
    seller = User(
        id=f"earn-seller-{idx}",
        phone_number=f"+234807100{idx:04d}",
        role=UserRole.seller,
        location_hub="Zaria",
    )
    collector = User(
        id=f"earn-collector-{idx}",
        phone_number=f"+234807200{idx:04d}",
        role=UserRole.collector,
    )
    material = MaterialCategory(
        slug=f"earn-copper-{idx}",
        name="Copper",
        price_per_kg_naira=1000,
        carbon_kg_co2e_per_kg=2.6,
    )
    test_session.add_all([seller, collector, material])
    await test_session.flush()

    listing = Listing(
        id=f"earn-listing-{idx}",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=10,
    )
    pickup = Pickup(
        id=f"earn-pickup-{idx}",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.pending_confirmation,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()

    txn = await settlement_service.settle_pickup(
        test_session, pickup, weight_kg=10.0, unit_price_naira=1000
    )
    return seller, collector, txn


@pytest.mark.asyncio
async def test_my_earnings_requires_auth(client):
    resp = await client.get("/api/v1/transactions/me/earnings")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_my_earnings_reflects_settled_handover(client, test_session):
    seller, collector, txn = await _settle_one(test_session, 1)

    # Sanity: the handshake settlement recorded both sides of the ledger.
    assert float(txn.seller_payout_naira) == 10000.0
    assert float(txn.collector_earnings_naira) == float(txn.gross_value_naira) - float(
        txn.platform_fee_naira
    )

    resp = await client.get(
        "/api/v1/transactions/me/earnings",
        headers={
            "Authorization": f"Bearer {security.create_access_token(collector.id, 'collector')}"
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "collector"
    assert data["settled_transactions"] == 1
    assert data["total_weight_kg"] == 10.0
    assert data["total_income_naira"] == float(txn.collector_earnings_naira)
    assert data["last_30_days_naira"] == float(txn.collector_earnings_naira)

    resp = await client.get(
        "/api/v1/transactions/me/earnings",
        headers={"Authorization": f"Bearer {security.create_access_token(seller.id, 'seller')}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "seller"
    assert data["settled_transactions"] == 1
    assert data["total_income_naira"] == float(txn.seller_payout_naira)


@pytest.mark.asyncio
async def test_my_earnings_scopes_to_the_caller(client, test_session):
    seller, collector, txn = await _settle_one(test_session, 2)

    # A different collector with no settled work sees zeroes, not the peer's income.
    other = User(
        id="earn-other-collector",
        phone_number="+2348079999999",
        role=UserRole.collector,
    )
    test_session.add(other)
    await test_session.flush()

    resp = await client.get(
        "/api/v1/transactions/me/earnings",
        headers={"Authorization": f"Bearer {security.create_access_token(other.id, 'collector')}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_income_naira"] == 0.0
    assert data["settled_transactions"] == 0


@pytest.mark.asyncio
async def test_my_earnings_includes_in_progress_estimate(client, test_session):
    seller = User(
        id="earn-est-seller",
        phone_number="+2348073000001",
        role=UserRole.seller,
        location_hub="Zaria",
    )
    collector = User(
        id="earn-est-collector",
        phone_number="+2348073000002",
        role=UserRole.collector,
    )
    material = MaterialCategory(
        slug="earn-est-copper",
        name="Copper",
        price_per_kg_naira=1000,
        carbon_kg_co2e_per_kg=2.6,
    )
    test_session.add_all([seller, collector, material])
    await test_session.flush()

    # An accepted job worth 15,000 (live, not yet settled).
    job_listing = Listing(
        id="earn-est-job",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=15,
        estimated_value_naira=15000,
    )
    job = Pickup(
        id="earn-est-pickup",
        listing_id=job_listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    # A second live listing the seller still holds, worth 8,000.
    open_listing = Listing(
        id="earn-est-open",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=8,
        estimated_value_naira=8000,
        status=ListingStatus.active,
    )
    test_session.add_all([job_listing, job, open_listing])
    await test_session.flush()

    collector_resp = await client.get(
        "/api/v1/transactions/me/earnings",
        headers={
            "Authorization": f"Bearer {security.create_access_token(collector.id, 'collector')}"
        },
    )
    assert collector_resp.status_code == 200
    data = collector_resp.json()
    assert data["total_income_naira"] == 0.0
    assert data["in_progress_value_naira"] == 15000.0
    assert data["estimated_income_naira"] == 15000.0

    seller_resp = await client.get(
        "/api/v1/transactions/me/earnings",
        headers={"Authorization": f"Bearer {security.create_access_token(seller.id, 'seller')}"},
    )
    assert seller_resp.status_code == 200
    data = seller_resp.json()
    # Both live listings belong to the seller.
    assert data["in_progress_value_naira"] == 23000.0
    assert data["estimated_income_naira"] == 23000.0
