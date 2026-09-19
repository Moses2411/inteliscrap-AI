from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    HubDelivery,
    HubRecyclingRequest,
    HubSubscription,
    HubSubscriptionStatus,
    RecyclingHub,
    Transaction,
    User,
    UserRole,
)


async def register_hub(db: AsyncSession, owner: User, **kwargs) -> RecyclingHub:
    hub = RecyclingHub(owner_user_id=owner.id, **kwargs)
    db.add(hub)
    await db.flush()
    owner.role = UserRole.recycling_hub
    await db.flush()
    return hub


async def get_hub_by_owner(db: AsyncSession, owner: User) -> RecyclingHub | None:
    return (
        await db.execute(
            select(RecyclingHub).where(RecyclingHub.owner_user_id == owner.id)
        )
    ).scalar_one_or_none()


async def get_hub_by_name(db: AsyncSession, name: str) -> RecyclingHub | None:
    return (
        await db.execute(
            select(RecyclingHub).where(
                RecyclingHub.name == name, RecyclingHub.is_active.is_(True)
            )
        )
    ).scalar_one_or_none()


async def get_hub_by_id(db: AsyncSession, hub_id: str) -> RecyclingHub | None:
    return (
        await db.execute(select(RecyclingHub).where(RecyclingHub.id == hub_id))
    ).scalar_one_or_none()


async def list_active_hubs(db: AsyncSession) -> list[RecyclingHub]:
    result = await db.execute(
        select(RecyclingHub).where(RecyclingHub.is_active.is_(True)).order_by(RecyclingHub.name)
    )
    return list(result.scalars().all())


async def create_request(
    db: AsyncSession,
    hub: RecyclingHub,
    material_category_id: int,
    requested_kg: float,
    requested_on: date,
    note: str | None = None,
) -> HubRecyclingRequest:
    req = HubRecyclingRequest(
        hub_id=hub.id,
        material_category_id=material_category_id,
        requested_kg=Decimal(str(requested_kg)),
        requested_on=requested_on,
        note=note,
    )
    db.add(req)
    await db.flush()
    return req


async def list_requests_for_hub(db: AsyncSession, hub_id: str) -> list[HubRecyclingRequest]:
    result = await db.execute(
        select(HubRecyclingRequest)
        .where(HubRecyclingRequest.hub_id == hub_id)
        .order_by(HubRecyclingRequest.requested_on.desc())
    )
    return list(result.scalars().all())


async def get_open_requests_for_hub_material(
    db: AsyncSession, hub_id: str, material_category_id: int
) -> list[HubRecyclingRequest]:
    today = date.today()
    result = await db.execute(
        select(HubRecyclingRequest).where(
            HubRecyclingRequest.hub_id == hub_id,
            HubRecyclingRequest.material_category_id == material_category_id,
            HubRecyclingRequest.status == "open",
            HubRecyclingRequest.requested_on == today,
        )
    )
    return list(result.scalars().all())


async def record_delivery(
    db: AsyncSession,
    hub: RecyclingHub,
    request: HubRecyclingRequest,
    transaction: Transaction,
    weight_kg: float,
    hub_price_naira: float = 0,
) -> HubDelivery:
    delivery = HubDelivery(
        hub_id=hub.id,
        request_id=request.id,
        transaction_id=transaction.id,
        material_category_id=request.material_category_id,
        weight_kg=Decimal(str(weight_kg)),
        hub_price_naira=Decimal(str(hub_price_naira)),
    )
    db.add(delivery)

    request.fulfilled_kg = (request.fulfilled_kg or Decimal("0")) + Decimal(str(weight_kg))
    if request.fulfilled_kg >= request.requested_kg:
        request.status = "filled"
    await db.flush()
    return delivery


async def get_deliveries_for_hub(db: AsyncSession, hub_id: str) -> list[HubDelivery]:
    result = await db.execute(
        select(HubDelivery)
        .where(HubDelivery.hub_id == hub_id)
        .order_by(HubDelivery.delivered_at.desc())
    )
    return list(result.scalars().all())


async def record_unmatched_delivery(
    db: AsyncSession,
    hub: RecyclingHub,
    transaction: Transaction,
    material_category_id: int,
    weight_kg: float,
    hub_price_naira: float = 0,
) -> HubDelivery:
    delivery = HubDelivery(
        hub_id=hub.id,
        request_id=None,
        transaction_id=transaction.id,
        material_category_id=material_category_id,
        weight_kg=Decimal(str(weight_kg)),
        hub_price_naira=Decimal(str(hub_price_naira)),
    )
    db.add(delivery)
    await db.flush()
    return delivery


async def create_subscription(
    db: AsyncSession,
    hub: RecyclingHub,
    plan_name: str = "Pro",
    amount_naira: float = 50000,
    payment_method: str | None = None,
    payment_reference: str | None = None,
) -> HubSubscription:
    now = datetime.utcnow()
    next_month = now.month % 12 + 1
    next_year = now.year + (1 if next_month == 1 else 0)
    next_billing = datetime(
        next_year, next_month, min(now.day, 28), now.hour, now.minute, now.second
    )

    sub = HubSubscription(
        hub_id=hub.id,
        plan_name=plan_name,
        amount_naira=Decimal(str(amount_naira)),
        payment_method=payment_method,
        payment_reference=payment_reference,
        started_at=now,
        next_billing_at=next_billing,
        status=HubSubscriptionStatus.active,
    )
    db.add(sub)
    await db.flush()
    return sub


async def list_subscriptions_for_hub(
    db: AsyncSession, hub_id: str
) -> list[HubSubscription]:
    result = await db.execute(
        select(HubSubscription)
        .where(HubSubscription.hub_id == hub_id)
        .order_by(HubSubscription.started_at.desc())
    )
    return list(result.scalars().all())


async def get_active_subscription(
    db: AsyncSession, hub_id: str
) -> HubSubscription | None:
    return (
        await db.execute(
            select(HubSubscription).where(
                HubSubscription.hub_id == hub_id,
                HubSubscription.status == HubSubscriptionStatus.active,
            )
        )
    ).scalar_one_or_none()
