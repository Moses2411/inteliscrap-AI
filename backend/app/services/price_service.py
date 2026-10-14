"""Material price management — single source of truth.

`MaterialCategory.price_per_kg_naira` is the canonical price used everywhere
(estimates, settlements, the EPR manifesto, the sync payload and the public rate
card). Every change is versioned and appended to `price_history` so an auditor
can reconstruct exactly what a material was worth, and when.

`PriceMatrix` is a legacy table kept only for backward compatibility; it is no
longer read or written here.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import MaterialCategory, PriceHistory, Transaction, TransactionStatus
from app.schemas import PriceMatrixUpdate


def is_stale(material: MaterialCategory) -> bool:
    if not material.price_last_updated_at:
        return True
    try:
        window = int(getattr(settings, "price_stale_hours", 72) or 72)
    except Exception:  # pragma: no cover - defensive
        window = 72
    return material.price_last_updated_at < datetime.utcnow() - timedelta(hours=window)


def with_freshness(items: list[MaterialCategory]) -> list[MaterialCategory]:
    for material in items:
        setattr(material, "is_stale", is_stale(material))
    return items


async def get_all(db: AsyncSession) -> list[MaterialCategory]:
    result = await db.execute(
        select(MaterialCategory)
        .where(MaterialCategory.is_active.is_(True))
        .order_by(MaterialCategory.sort_order.asc())
    )
    return with_freshness(list(result.scalars().all()))


async def _last_settled_price(db: AsyncSession, material_id: int) -> float | None:
    """Most recent price a seller actually settled at, for audit context."""
    result = await db.execute(
        select(Transaction.unit_price_naira)
        .where(
            Transaction.material_category_id == material_id,
            Transaction.status == TransactionStatus.settled,
        )
        .order_by(Transaction.settled_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return float(row) if row is not None else None


async def upsert_price(
    db: AsyncSession,
    payload: PriceMatrixUpdate,
    actor_id: str | None = None,
) -> MaterialCategory | None:
    result = await db.execute(
        select(MaterialCategory).where(MaterialCategory.slug == payload.material_class)
    )
    material = result.scalar_one_or_none()
    if not material:
        result = await db.execute(
            select(MaterialCategory).where(MaterialCategory.name == payload.material_class)
        )
        material = result.scalar_one_or_none()
    if not material:
        return None

    new_price = float(payload.price_per_kg_naira)
    material.price_per_kg_naira = new_price
    material.price_version = (material.price_version or 1) + 1
    material.price_last_updated_at = datetime.utcnow()
    material.price_source = "admin"
    if payload.updated_by:
        material.updated_by = payload.updated_by
    if actor_id:
        material.price_updated_by_id = actor_id

    db.add(
        PriceHistory(
            material_category_id=material.id,
            price_per_kg_naira=new_price,
            carbon_kg_co2e_per_kg=material.carbon_kg_co2e_per_kg or 0,
            source="admin",
            reason=payload.reason,
            updated_by_id=actor_id,
        )
    )

    await db.flush()
    await db.refresh(material)
    setattr(material, "is_stale", is_stale(material))
    return material


async def get_history(db: AsyncSession, material_class: str) -> list[PriceHistory]:
    result = await db.execute(
        select(MaterialCategory).where(MaterialCategory.slug == material_class)
    )
    material = result.scalar_one_or_none()
    if not material:
        result = await db.execute(
            select(MaterialCategory).where(MaterialCategory.name == material_class)
        )
        material = result.scalar_one_or_none()
    if not material:
        return []
    rows = await db.execute(
        select(PriceHistory)
        .where(PriceHistory.material_category_id == material.id)
        .order_by(PriceHistory.changed_at.desc())
        .limit(50)
    )
    return list(rows.scalars().all())


__all__ = [
    "is_stale",
    "with_freshness",
    "get_all",
    "upsert_price",
    "get_history",
    "_last_settled_price",
]
