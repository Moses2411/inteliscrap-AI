import pytest

from app.core import security
from app.models import (
    Listing,
    ListingStatus,
    MaterialCategory,
    Pickup,
    PickupStatus,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
    UserRole,
)
from app.services import settlement_service


async def _admin_headers(test_session) -> dict:
    admin = User(
        id="impact-admin",
        phone_number="+2348062000001",
        role=UserRole.admin,
        is_verified=True,
    )
    test_session.add(admin)
    await test_session.flush()
    token = security.create_access_token(admin.id, UserRole.admin.value)
    return {"Authorization": f"Bearer {token}"}


async def _settle_one(test_session, idx: int):
    seller = User(
        id=f"impact-seller-{idx}",
        phone_number=f"+234806000{idx:04d}",
        role=UserRole.seller,
        location_hub="Zaria",
    )
    collector = User(
        id=f"impact-collector-{idx}",
        phone_number=f"+234806100{idx:04d}",
        role=UserRole.collector,
    )
    material = MaterialCategory(
        slug=f"copper-{idx}",
        name="Copper",
        price_per_kg_naira=3200,
        carbon_kg_co2e_per_kg=2.6,
    )
    test_session.add_all([seller, collector, material])
    await test_session.flush()

    listing = Listing(
        id=f"impact-listing-{idx}",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=5,
    )
    pickup = Pickup(
        id=f"impact-pickup-{idx}",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()
    await settlement_service.settle_pickup(test_session, pickup, weight_kg=5.0)


@pytest.mark.asyncio
async def test_impact_requires_auth(client):
    resp = await client.get("/api/v1/impact/summary")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_impact_summary(client, test_session):
    await _settle_one(test_session, 1)
    await _settle_one(test_session, 2)
    headers = await _admin_headers(test_session)

    resp = await client.get("/api/v1/impact/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["transactions_count"] == 2
    assert data["total_transactions"] == 2
    assert data["total_tonnage_kg"] == 10.0
    assert data["total_carbon_offset_kg_co2e"] == 26.0
    assert data["total_collector_income_naira"] == 30400.0
    # Live path: computed directly from the settlement ledger.
    assert data["computed_from"] == "settlements"
    assert data["platform_revenue_naira"] == 1600.0
    assert data["seller_payout_naira"] == 32000.0


@pytest.mark.asyncio
async def test_impact_falls_back_to_logs_without_settlements(client, test_session):
    from datetime import date

    from app.models import NGOImpactLog, Transaction, TransactionStatus

    seller = User(
        id="fb-seller",
        phone_number="+2348063000001",
        role=UserRole.seller,
        location_hub="Zaria",
    )
    collector = User(
        id="fb-collector",
        phone_number="+2348063000002",
        role=UserRole.collector,
    )
    material = MaterialCategory(
        slug="fb-copper",
        name="Fallback Copper",
        price_per_kg_naira=1000,
        carbon_kg_co2e_per_kg=2.0,
    )
    test_session.add_all([seller, collector, material])
    await test_session.flush()

    listing = Listing(
        id="fb-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=3,
    )
    pickup = Pickup(
        id="fb-pickup",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()

    txn = Transaction(
        id="fb-txn",
        pickup_id=pickup.id,
        seller_id=seller.id,
        collector_id=collector.id,
        material_category_id=material.id,
        weight_kg=3,
        unit_price_naira=1000,
        gross_value_naira=3000,
        platform_fee_naira=150,
        collector_earnings_naira=2850,
        seller_payout_naira=3000,
        status=TransactionStatus.pending,  # deliberately NOT settled
    )
    test_session.add(txn)
    await test_session.flush()

    test_session.add(
        NGOImpactLog(
            transaction_id=txn.id,
            material_category_id=material.id,
            tonnage_kg=3,
            carbon_offset_kg_co2e=6,
            collector_income_naira=2850,
            hub="Zaria",
            period=date.today(),
        )
    )
    await test_session.flush()

    headers = await _admin_headers(test_session)
    resp = await client.get("/api/v1/impact/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["computed_from"] == "ngo_impact_logs"
    assert data["total_tonnage_kg"] == 3.0
    assert data["transactions_count"] == 1
    assert data["platform_revenue_naira"] == 0.0


@pytest.mark.asyncio
async def test_impact_by_material(client, test_session):
    await _settle_one(test_session, 3)
    headers = await _admin_headers(test_session)
    resp = await client.get("/api/v1/impact/by-material", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["material"] == "Copper"
    assert data[0]["tonnage_kg"] == 5.0


@pytest.mark.asyncio
async def test_impact_daily(client, test_session):
    await _settle_one(test_session, 4)
    headers = await _admin_headers(test_session)
    resp = await client.get("/api/v1/impact/daily", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["tonnage_kg"] == 5.0


@pytest.mark.asyncio
async def test_impact_ops_requires_auth(client):
    resp = await client.get("/api/v1/impact/ops")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_impact_ops_overview(client, test_session):
    seller = User(
        id="ops-seller",
        phone_number="+2348070000001",
        role=UserRole.seller,
        location_hub="Zaria",
    )
    collector = User(
        id="ops-collector",
        phone_number="+2348070000002",
        role=UserRole.collector,
    )
    material = MaterialCategory(
        slug="ops-copper",
        name="Ops Copper",
        price_per_kg_naira=3200,
        carbon_kg_co2e_per_kg=2.6,
    )
    test_session.add_all([seller, collector, material])
    await test_session.flush()

    # An active job (accepted) worth 15,000 at the listing estimate.
    job_listing = Listing(
        id="ops-job-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=5,
        estimated_value_naira=15000,
    )
    job = Pickup(
        id="ops-job-pickup",
        listing_id=job_listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    # An open offer (offered) on a still-active listing worth 9,000.
    offer_listing = Listing(
        id="ops-offer-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=3,
        estimated_value_naira=9000,
        status=ListingStatus.active,
    )
    offer = Pickup(
        id="ops-offer-pickup",
        listing_id=offer_listing.id,
        collector_id=collector.id,
        status=PickupStatus.offered,
    )
    test_session.add_all([job_listing, job, offer_listing, offer])
    await test_session.flush()

    headers = await _admin_headers(test_session)
    resp = await client.get("/api/v1/impact/ops", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_jobs"] == 1
    assert data["available_offers"] == 1
    assert data["jobs_value_naira"] == 15000.0
    assert data["offers_value_naira"] == 9000.0


async def _ngo_headers(test_session, *, premium: bool, idx: int) -> dict:
    from datetime import datetime, timedelta

    ngo = User(
        id=f"impact-ngo-{idx}",
        phone_number=f"+23480630000{idx:02d}",
        role=UserRole.ngo,
    )
    if premium:
        ngo.subscription_plan = SubscriptionPlan.ngo_yearly
        ngo.subscription_status = SubscriptionStatus.active
        ngo.subscription_expires_at = datetime.utcnow() + timedelta(days=30)
    test_session.add(ngo)
    await test_session.flush()
    token = security.create_access_token(ngo.id, UserRole.ngo.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_impact_ngo_requires_premium(client, test_session):
    await _settle_one(test_session, 5)
    headers = await _ngo_headers(test_session, premium=False, idx=5)
    resp = await client.get("/api/v1/impact/summary", headers=headers)
    assert resp.status_code == 402


@pytest.mark.asyncio
async def test_impact_ngo_premium_grants_data(client, test_session):
    await _settle_one(test_session, 6)
    headers = await _ngo_headers(test_session, premium=True, idx=6)
    resp = await client.get("/api/v1/impact/summary", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["computed_from"] == "settlements"
