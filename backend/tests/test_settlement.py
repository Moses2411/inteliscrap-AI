from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core import security
from app.models import (
    Listing,
    MaterialCategory,
    NGOImpactLog,
    Pickup,
    PickupStatus,
    User,
    UserRole,
)
from app.services import settlement_service


async def _seed(test_session):
    seller = User(
        id="settle-seller",
        phone_number="+2348050000001",
        role=UserRole.household,
        location_hub="Zaria",
    )
    collector = User(
        id="settle-collector",
        phone_number="+2348050000002",
        role=UserRole.collector,
    )
    material = MaterialCategory(
        slug="copper", name="Copper", price_per_kg_naira=3200, carbon_kg_co2e_per_kg=2.6
    )
    test_session.add_all([seller, collector, material])
    await test_session.flush()

    listing = Listing(
        id="settle-listing",
        seller_id=seller.id,
        material_category_id=material.id,
        estimated_weight_kg=5,
        estimated_value_naira=16000,
        latitude=11.0,
        longitude=7.0,
    )
    pickup = Pickup(
        id="settle-pickup",
        listing_id=listing.id,
        collector_id=collector.id,
        status=PickupStatus.accepted,
    )
    test_session.add_all([listing, pickup])
    await test_session.flush()
    return seller, collector, material, listing, pickup


@pytest.mark.asyncio
async def test_settle_creates_transaction_and_impact(test_session):
    _, _, _, listing, pickup = await _seed(test_session)

    txn = await settlement_service.settle_pickup(test_session, pickup, weight_kg=5.0)

    assert txn.weight_kg == Decimal("5.000")
    assert txn.gross_value_naira == Decimal("16000.00")
    assert txn.platform_fee_naira == Decimal("800.00")
    assert txn.collector_earnings_naira == Decimal("15200.00")
    assert txn.seller_payout_naira == Decimal("16000.00")

    impact = (
        await test_session.execute(
            select(NGOImpactLog).where(NGOImpactLog.transaction_id == txn.id)
        )
    ).scalar_one()
    assert impact.tonnage_kg == Decimal("5.000")
    assert impact.carbon_offset_kg_co2e == Decimal("13.0000")
    assert impact.collector_income_naira == Decimal("15200.00")
    assert impact.hub == "Zaria"

    assert pickup.status == PickupStatus.completed
    assert listing.status.value == "completed"
    assert listing.actual_weight_kg == Decimal("5.000")


@pytest.mark.asyncio
async def test_settle_rejects_non_positive_weight(test_session):
    _, _, _, _, pickup = await _seed(test_session)
    with pytest.raises(ValueError):
        await settlement_service.settle_pickup(test_session, pickup, weight_kg=0)


@pytest.mark.asyncio
async def test_settle_endpoint(client, test_session):
    _, _, _, _, _ = await _seed(test_session)
    token = security.create_access_token("settle-collector", UserRole.collector.value)
    resp = await client.post(
        "/api/v1/pickups/settle-pickup/settle",
        json={"weight_kg": 5.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["gross_value_naira"] == 16000.0
    assert data["collector_earnings_naira"] == 15200.0
    assert data["status"] == "settled"


@pytest.mark.asyncio
async def test_settle_rejects_other_collector(client, test_session):
    await _seed(test_session)
    other = User(id="settle-other", phone_number="+2348050000003", role=UserRole.collector)
    test_session.add(other)
    await test_session.flush()
    other_token = security.create_access_token("settle-other", UserRole.collector.value)
    resp = await client.post(
        "/api/v1/pickups/settle-pickup/settle",
        json={"weight_kg": 5.0},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 403
