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
from app.services import pickup_service, user_service

HUB_PRESETS: dict[str, tuple[str, float, float]] = {
    "1": ("Samaru", 11.1547, 7.6478),
    "2": ("Sabon Gari", 11.1313, 7.6299),
    "3": ("Kongo", 11.1113, 7.7227),
    "4": ("Bomo", 11.1426, 7.6983),
    "5": ("Hanwa", 11.0962, 7.7415),
    "6": ("Dutsen Abba", 11.0952, 7.6875),
}

HUB_MENU = (
    "CON Zabi wurin da kake aiki:\n"
    + "\n".join(f"{k}. {name}" for k, (name, _, _) in HUB_PRESETS.items())
)


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
    "3. Yanayin lissafi\n"
    "4. Wurin da nake aiki"
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


async def _register_flow(db: AsyncSession, phone_number: str, text: str) -> str:
    """Feature-phone onboarding: register a caller as a collector from a preset hub.

    Flow: empty -> confirm registration; '1' -> pick hub; '1*N' -> create the
    collector account with coordinates so H3 dispatch can find them.
    """
    parts = [p for p in (text or "").split("*") if p != ""]

    if not parts:
        return (
            "CON Barka da zuwa InteliScrap!\n"
            "Wannan lambar ba ta da rijista.\n"
            "1. Yi rijista a matsayin mai karba\n"
            "2. Koma baya"
        )

    if parts[0] == "2":
        return "END Na gode. Sai anjima."

    if parts[0] != "1":
        return "END Zabin bai inganta ba."

    hub_index = parts[1] if len(parts) > 1 else ""
    if hub_index not in HUB_PRESETS:
        return HUB_MENU

    hub_name, lat, lng = HUB_PRESETS[hub_index]

    existing = await user_service.get_by_phone(db, phone_number)
    if existing is None:
        collector = User(
            phone_number=phone_number,
            role=UserRole.collector,
            full_name="Mai karba (USSD)",
        )
        db.add(collector)
        await db.flush()
    else:
        existing.role = UserRole.collector
        collector = existing

    await user_service.set_user_location(db, collector, lat, lng)
    return f"END An yi rijista! Wurin aiki: {hub_name}. Kai wayarku ta kara kira don ganin kaya."


async def _location_flow(db: AsyncSession, collector: User, rest: list[str]) -> str:
    if not rest or rest[0] not in HUB_PRESETS:
        return HUB_MENU

    hub_name, lat, lng = HUB_PRESETS[rest[0]]
    collector.location_hub = hub_name
    await user_service.set_user_location(db, collector, lat, lng)
    return f"END An sabunta wurin aiki: {hub_name}."


async def process_ussd(db: AsyncSession, phone_number: str, text: str) -> str:
    collector = await _find_collector(db, phone_number)
    if collector is None:
        return await _register_flow(db, phone_number, text)

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
    if head == "4":
        return await _location_flow(db, collector, rest)
    return "END Zabin bai inganta ba."
