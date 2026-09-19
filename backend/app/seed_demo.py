from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CompliancePartner,
    HubRecyclingRequest,
    HubSubscription,
    HubSubscriptionStatus,
    Listing,
    ListingStatus,
    MaterialCategory,
    NGOImpactLog,
    Pickup,
    PickupStatus,
    RecyclingHub,
    Transaction,
    TransactionStatus,
    User,
    UserRole,
)


def _demo_users() -> list[dict]:
    return [
        {
            "id": "demo-seller",
            "phone_number": "+2348000000001",
            "full_name": "Amina Hauwa",
            "role": UserRole.household,
            "location_hub": "Zaria",
        },
        {
            "id": "demo-collector",
            "phone_number": "+2348000000002",
            "full_name": "Musa Bello",
            "role": UserRole.collector,
            "location_hub": "Samaru",
            "latitude": 11.0457,
            "longitude": 7.7065,
            "h3_cell": "8809c4e34bfffff",
        },
        {
            "id": "demo-hub-owner",
            "phone_number": "+2348000000003",
            "full_name": "GreenCycle Hub Ltd",
            "role": UserRole.recycling_hub,
            "location_hub": "Zaria",
        },
        {
            "id": "demo-admin",
            "phone_number": "+2348000000004",
            "full_name": "Admin",
            "role": UserRole.admin,
        },
        {
            "id": "demo-ngo",
            "phone_number": "+2348000000005",
            "full_name": "Impact NGO",
            "role": UserRole.ngo,
        },
    ]


async def seed_demo_data(db: AsyncSession) -> int:
    """Idempotently create demo data when the DB has no users yet.

    Returns the number of users created (0 if skipped).
    """
    count = (
        await db.execute(select(func.count()).select_from(User))
    ).scalar_one()
    if count > 0:
        return 0

    for data in _demo_users():
        db.add(User(is_verified=True, **data))
    await db.flush()

    materials: dict[str, MaterialCategory] = {}
    rows = (await db.execute(select(MaterialCategory))).scalars().all()
    for mat in rows:
        materials[mat.slug] = mat

    hub = RecyclingHub(
        id="demo-hub",
        owner_user_id="demo-hub-owner",
        name="GreenCycle Hub",
        address_text="Kongo Road, Zaria",
        city="Zaria",
        contact_phone="+2348000000100",
    )
    db.add(hub)
    await db.flush()

    db.add(
        HubSubscription(
            id="demo-sub",
            hub_id=hub.id,
            plan_name="Pro",
            amount_naira=Decimal("50000.00"),
            status=HubSubscriptionStatus.active,
            started_at=datetime.utcnow() - timedelta(days=21),
            next_billing_at=datetime.utcnow() + timedelta(days=9),
        )
    )

    copper = materials.get("copper")
    alum = materials.get("aluminum")
    pet = materials.get("pet-plastic")
    today = date.today()
    if copper is not None:
        db.add(
            HubRecyclingRequest(
                id="demo-req-copper",
                hub_id=hub.id,
                material_category_id=copper.id,
                requested_kg=Decimal("100.000"),
                fulfilled_kg=Decimal("42.000"),
                requested_on=today,
            )
        )
    if alum is not None:
        db.add(
            HubRecyclingRequest(
                id="demo-req-alum",
                hub_id=hub.id,
                material_category_id=alum.id,
                requested_kg=Decimal("200.000"),
                fulfilled_kg=Decimal("0.000"),
                requested_on=today,
            )
        )
    if pet is not None:
        db.add(
            HubRecyclingRequest(
                id="demo-req-pet",
                hub_id=hub.id,
                material_category_id=pet.id,
                requested_kg=Decimal("300.000"),
                fulfilled_kg=Decimal("120.000"),
                requested_on=today,
            )
        )
    await db.flush()

    # A couple of demo transactions + impact logs for the compliance
    # manifesto and impact dashboard to show real numbers.
    if copper is not None:
        await _add_demo_transaction(
            db,
            pickup_id="demo-pickup-1",
            listing_id="demo-listing-1",
            seller_id="demo-seller",
            collector_id="demo-collector",
            material=copper,
            weight=Decimal("10.000"),
            created_days_ago=2,
        )
    if alum is not None:
        await _add_demo_transaction(
            db,
            pickup_id="demo-pickup-2",
            listing_id="demo-listing-2",
            seller_id="demo-seller",
            collector_id="demo-collector",
            material=alum,
            weight=Decimal("25.000"),
            created_days_ago=1,
        )

    # One pending listing with an offered pickup, so the collector
    # can accept and settle a live job during the demo.
    if copper is not None:
        listing = Listing(
            id="demo-listing-3",
            seller_id="demo-seller",
            material_category_id=copper.id,
            title="Copper coils",
            estimated_weight_kg=Decimal("15.000"),
            estimated_value_naira=copper.price_per_kg_naira * 15,
            latitude=11.05,
            longitude=7.72,
            address_text="Samaru, Zaria",
            contact_phone="+2348000000001",
            status=ListingStatus.matched,
        )
        db.add(listing)
        await db.flush()
        db.add(
            Pickup(
                id="demo-pickup-3",
                listing_id=listing.id,
                collector_id="demo-collector",
                status=PickupStatus.accepted,
                distance_m=1200,
                accepted_at=datetime.utcnow() - timedelta(minutes=8),
            )
        )

    db.add(
        CompliancePartner(
            id="demo-partner",
            name="EPRON Nigeria (Demo)",
            partner_type="pro",
            api_key="demo-epron-key",
        )
    )
    await db.flush()
    return len(_demo_users())


async def _add_demo_transaction(
    db: AsyncSession,
    pickup_id: str,
    listing_id: str,
    seller_id: str,
    collector_id: str,
    material: MaterialCategory,
    weight: Decimal,
    created_days_ago: int,
) -> None:
    listing = Listing(
        id=listing_id,
        seller_id=seller_id,
        material_category_id=material.id,
        title=f"Demo {material.name}",
        estimated_weight_kg=weight,
        estimated_value_naira=material.price_per_kg_naira * weight,
        latitude=11.04,
        longitude=7.7,
        address_text="Zaria",
        status=ListingStatus.completed,
        actual_weight_kg=weight,
        final_value_naira=material.price_per_kg_naira * weight,
    )
    pickup = Pickup(
        id=pickup_id,
        listing_id=listing_id,
        collector_id=collector_id,
        status=PickupStatus.completed,
        accepted_at=datetime.utcnow() - timedelta(days=created_days_ago),
    )
    db.add_all([listing, pickup])
    await db.flush()

    gross = (material.price_per_kg_naira * weight).quantize(Decimal("0.01"))
    fee = (gross * Decimal("0.05")).quantize(Decimal("0.01"))
    earnings = gross - fee
    carbon = (weight * Decimal(str(material.carbon_kg_co2e_per_kg))).quantize(
        Decimal("0.0001")
    )
    txn = Transaction(
        id=f"demo-txn-{pickup_id}",
        pickup_id=pickup_id,
        seller_id=seller_id,
        collector_id=collector_id,
        material_category_id=material.id,
        weight_kg=weight,
        unit_price_naira=material.price_per_kg_naira,
        gross_value_naira=gross,
        platform_fee_naira=fee,
        collector_earnings_naira=earnings,
        seller_payout_naira=gross,
        status=TransactionStatus.settled,
        settled_at=datetime.utcnow() - timedelta(days=created_days_ago),
    )
    db.add(txn)
    await db.flush()

    db.add(
        NGOImpactLog(
            transaction_id=txn.id,
            material_category_id=material.id,
            tonnage_kg=weight,
            carbon_offset_kg_co2e=carbon,
            collector_income_naira=earnings,
            hub="GreenCycle Hub",
            period=date.today() - timedelta(days=created_days_ago),
        )
    )
    await db.flush()
