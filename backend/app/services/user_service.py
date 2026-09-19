import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.schemas import UserCreate
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
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def set_user_location(
    db: AsyncSession, user: User, latitude: float | None, longitude: float | None
) -> User:
    """Persist a user's coordinates and refresh their Uber H3 hexagon index cell.

    The h3_cell column is what lets dispatch query collectors by hexagonal bucket
    instead of scanning every row.
    """
    user.latitude = latitude
    user.longitude = longitude
    user.h3_cell = (
        latlng_to_h3_cell(latitude, longitude)
        if latitude is not None and longitude is not None
        else None
    )
    await db.flush()
    return user
