from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Listing,
    MaterialCategory,
    Pickup,
    PickupStatus,
    Transaction,
    TransactionStatus,
    User,
    UserRole,
)
from app.services import pickup_service


def _fmt_num(value) -> str:
    if value is None:
        return "0"
    try:
        return f"{float(value):g}"
    except (TypeError, ValueError):
        return str(value)


MAIN_MENU = (
    "CON Karibun zuwa InteliScrap!\n"
    "1. Sabbin kaya\n"
    "2. Ayyukana\n"
    "3. Yanayin lissafi"
)


async def _find_collector(db: AsyncSession, phone_number: str) -> User | None:
    result = await db.execute(
        select(User).where(User.phone_number == phone_number, User.role == UserRole.collector)
    )
    return result.scalar_one_or_none()


async def _new_pickups_flow(db: AsyncSession, collector: User, rest: list[str]) -> str:
    offers = await pickup_service.get_pending_offers(db, collector)

    if not rest:
        if not offers:
            return "END Babu sabbin kaya a yanzu. Sake duba anjima."
        lines = ["CON Zabi kaya:"]
        for i, (_, listing, material) in enumerate(offers, start=1):
            lines.append(f"{i}. {material.name} - {_fmt_num(listing.estimated_weight_kg)}kg")
        return "\n".join(lines)

    try:
        index = int(rest[0])
    except ValueError:
        return "END Zabin bai inganta ba."

    if index < 1 or index > len(offers):
        return "END Zabin bai inganta ba."

    pickup, listing, material = offers[index - 1]

    if len(rest) == 1:
        weight = _fmt_num(listing.estimated_weight_kg)
        value = _fmt_num(listing.estimated_value_naira)
        return (
            f"CON {material.name} ({material.name_ha or ''})\n"
            f"Nauyi: {weight}kg | Kima: N{value}\n"
            f"Adireshi: {listing.address_text or 'Zaria'}\n"
            "1. Karba (accept)\n2. Koma baya"
        )

    if rest[1] == "1":
        await pickup_service.accept_pickup(db, pickup, listing)
        await pickup_service.enqueue_location_sms(db, collector, pickup, listing)
        return "END An karba. An aiko maka SMS da cikakken adireshin. Na gode!"

    return MAIN_MENU


async def _my_pickups_flow(db: AsyncSession, collector: User, rest: list[str]) -> str:
    result = await db.execute(
        select(Pickup, Listing, MaterialCategory)
        .join(Listing, Pickup.listing_id == Listing.id)
        .join(MaterialCategory, Listing.material_category_id == MaterialCategory.id)
        .where(
            Pickup.collector_id == collector.id,
            Pickup.status.in_([PickupStatus.accepted, PickupStatus.en_route, PickupStatus.arrived]),
        )
        .order_by(Pickup.accepted_at.desc())
    )
    active = list(result.all())

    if not active:
        return "END Ba ka da ayyuka a halin yanzu."

    lines = ["CON Ayyukanka:"]
    for i, (pickup, _, material) in enumerate(active, start=1):
        lines.append(f"{i}. {material.name} - {pickup.status.value}")
    return "\n".join(lines)


async def _balance_flow(db: AsyncSession, collector: User) -> str:
    result = await db.execute(
        select(func.coalesce(func.sum(Transaction.collector_earnings_naira), 0)).where(
            Transaction.collector_id == collector.id,
            Transaction.status == TransactionStatus.settled,
        )
    )
    total = result.scalar_one()
    return f"END Jimillar samunka: N{_fmt_num(total)}."


async def process_ussd(db: AsyncSession, phone_number: str, text: str) -> str:
    collector = await _find_collector(db, phone_number)
    if collector is None:
        return "END Wannan lambar ba ta da rijista a InteliScrap."

    parts = [p for p in (text or "").split("*") if p != ""]

    if not parts:
        return MAIN_MENU

    head, *rest = parts

    if head == "1":
        return await _new_pickups_flow(db, collector, rest)
    if head == "2":
        return await _my_pickups_flow(db, collector, rest)
    if head == "3":
        return await _balance_flow(db, collector)
    return "END Zabin bai inganta ba."
