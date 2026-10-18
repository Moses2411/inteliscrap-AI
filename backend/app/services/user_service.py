import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.schemas import UserCreate
from app.services import location_service
from app.services.matching_service import latlng_to_h3_cell


async def get_by_phone(db: AsyncSession, phone_number: str) -> User | None:
    result = await db.execute(select(User).where(User.phone_number == phone_number))
    return result.scalar_one_or_none()


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
