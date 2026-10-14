from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.database import get_db
from app.models import MaterialCategory, User, UserRole
from app.schemas import PriceMatrixItem, PriceMatrixUpdate
from app.services import price_service

router = APIRouter(prefix="/api/v1/prices", tags=["prices"])


def _serialize(material: MaterialCategory) -> PriceMatrixItem:
    return PriceMatrixItem(
        material_class=material.slug,
        name=material.name,
        price_per_kg_naira=float(material.price_per_kg_naira),
        carbon_kg_co2e_per_kg=float(material.carbon_kg_co2e_per_kg or 0),
        price_last_updated_at=material.price_last_updated_at,
        price_source=material.price_source or "seed",
        price_version=material.price_version or 1,
        is_stale=bool(getattr(material, "is_stale", False)),
    )


@router.get("/", response_model=list[PriceMatrixItem])
async def list_prices(db: AsyncSession = Depends(get_db)):
    """Public read of the canonical material rate card (with freshness)."""
    prices = await price_service.get_all(db)
    return [_serialize(p) for p in prices]


@router.get("/{material_class}/history")
async def price_history(
    material_class: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.recycling_hub)),
):
    history = await price_service.get_history(db, material_class)
    return {
        "material_class": material_class,
        "count": len(history),
        "items": [
            {
                "price_per_kg_naira": float(h.price_per_kg_naira),
                "carbon_kg_co2e_per_kg": float(h.carbon_kg_co2e_per_kg or 0),
                "source": h.source,
                "reason": h.reason,
                "updated_by_id": h.updated_by_id,
                "changed_at": h.changed_at,
            }
            for h in history
        ],
    }


@router.put("/{material_class}", response_model=PriceMatrixItem)
async def update_price(
    material_class: str,
    payload: PriceMatrixUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.recycling_hub)),
):
    """Update a material price.

    Requires an admin/hub actor and a non-empty ``reason``; the change is
    versioned and written to the append-only ``price_history`` audit trail.
    """
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A reason is required for every price change (audit trail).",
        )
    if payload.price_per_kg_naira <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="price_per_kg_naira must be greater than zero.",
        )

    resolved = payload.model_copy(update={"material_class": material_class})
    updated = await price_service.upsert_price(db, resolved, actor_id=user.id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material class not found",
        )
    return _serialize(updated)
