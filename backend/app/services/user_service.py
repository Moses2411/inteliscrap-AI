import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.schemas import UserCreate


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
