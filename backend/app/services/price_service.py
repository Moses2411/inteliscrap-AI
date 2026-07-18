from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import PriceMatrix
from app.schemas import PriceMatrixUpdate


async def get_all(db: AsyncSession) -> list[PriceMatrix]:
    result = await db.execute(select(PriceMatrix).order_by(PriceMatrix.material_class))
    return list(result.scalars().all())


async def upsert_price(db: AsyncSession, payload: PriceMatrixUpdate) -> PriceMatrix | None:
    result = await db.execute(
        select(PriceMatrix).where(PriceMatrix.material_class == payload.material_class)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.price_per_kg_naira = payload.price_per_kg_naira
        existing.updated_by = payload.updated_by
    else:
        existing = PriceMatrix(
            material_class=payload.material_class,
            price_per_kg_naira=payload.price_per_kg_naira,
            updated_by=payload.updated_by,
        )
        db.add(existing)

    await db.flush()
    await db.refresh(existing)
    return existing
