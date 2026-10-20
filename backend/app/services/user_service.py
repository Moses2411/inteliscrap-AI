import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.schemas import UserCreate
from app.services import location_service
from app.services.matching_service import latlng_to_h3_cell


def phone_variants(phone_number: str) -> list[str]:
    """Every stored format of the same phone number.

    ``+2348012345678``, ``08012345678``, ``8012345678`` and ``2348012345678``
    are one number — without this the same person ends up with two accounts
    and their jobs land on the wrong one.
    """
    raw = re.sub(r"[\s\-()]", "", phone_number or "")
    if not raw:
        return []
    variants = {raw}
    local = None
    if re.fullmatch(r"\+234\d{10}", raw):
        local = "0" + raw[4:]
    elif re.fullmatch(r"234\d{10}", raw):
        local = "0" + raw[3:]
    elif re.fullmatch(r"0\d{10}", raw):
        local = raw
    elif re.fullmatch(r"\d{10}", raw):
        local = "0" + raw
    if local:
        variants.add(local)
        variants.add("+234" + local[1:])
        variants.add(local[1:])
    return list(variants)


async def get_by_phone(db: AsyncSession, phone_number: str) -> User | None:
    variants = phone_variants(phone_number)
    if not variants:
        return None
    result = await db.execute(
        select(User)
        .where(User.phone_number.in_(variants))
        .order_by(User.created_at.asc())
    )
    return result.scalars().first()


async def get_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, payload: UserCreate) -> User:
    user = User(
        id=payload.id or str(uuid.uuid4()),
        phone_number=payload.phone_number,
        full_name=payload.full_name,
        location_hub=payload.location_hub or "Zaria",
        address_text=payload.address_text,
    )
    db.add(user)
    await db.flush()

    # Place the user from their area/address when no GPS fix is available.
    resolved = location_service.resolve_fallback(user.location_hub, user.address_text)
    if resolved is not None:
        latitude, longitude, precision = resolved
        await set_user_location(db, user, latitude, longitude, precision=precision)

    await db.refresh(user)
    return user


async def set_user_location(
    db: AsyncSession,
    user: User,
    latitude: float | None,
    longitude: float | None,
    precision: str = "gps",
) -> User:
    """Persist a user's coordinates and refresh their Uber H3 hexagon index cell.

    The h3_cell column is what lets dispatch query collectors by hexagonal bucket
    instead of scanning every row. ``precision`` records how the coordinate was
    obtained ("gps", "hub" or "address") so dispatch can widen its radius for
    approximate area-level fallbacks.
    """
    user.latitude = latitude
    user.longitude = longitude
    user.location_precision = precision if latitude is not None else None
    user.h3_cell = (
        latlng_to_h3_cell(latitude, longitude)
        if latitude is not None and longitude is not None
        else None
    )
    await db.flush()
    return user
