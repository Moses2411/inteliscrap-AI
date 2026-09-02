from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MaterialCategory, NGOImpactLog


async def get_summary(db: AsyncSession) -> dict:
    result = await db.execute(
        select(
            func.coalesce(func.sum(NGOImpactLog.tonnage_kg), 0),
            func.coalesce(func.sum(NGOImpactLog.carbon_offset_kg_co2e), 0),
            func.coalesce(func.sum(NGOImpactLog.collector_income_naira), 0),
            func.count(NGOImpactLog.id),
        )
    )
    tonnage, carbon, income, count = result.one()
    return {
        "total_tonnage_kg": float(tonnage),
        "total_carbon_offset_kg_co2e": float(carbon),
        "total_collector_income_naira": float(income),
        "transactions_count": int(count),
    }


async def get_daily(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(
            NGOImpactLog.period,
            func.sum(NGOImpactLog.tonnage_kg),
            func.sum(NGOImpactLog.carbon_offset_kg_co2e),
            func.sum(NGOImpactLog.collector_income_naira),
        )
        .group_by(NGOImpactLog.period)
        .order_by(NGOImpactLog.period.asc())
    )
    return [
        {
            "period": str(period),
            "tonnage_kg": float(tonnage),
            "carbon_offset_kg_co2e": float(carbon),
            "collector_income_naira": float(income),
        }
        for period, tonnage, carbon, income in result.all()
    ]


async def get_by_material(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(
            MaterialCategory.name,
            func.sum(NGOImpactLog.tonnage_kg),
            func.sum(NGOImpactLog.carbon_offset_kg_co2e),
        )
        .join(MaterialCategory, NGOImpactLog.material_category_id == MaterialCategory.id)
        .group_by(MaterialCategory.name)
        .order_by(func.sum(NGOImpactLog.tonnage_kg).desc())
    )
    return [
        {
            "material": name,
            "tonnage_kg": float(tonnage),
            "carbon_offset_kg_co2e": float(carbon),
        }
        for name, tonnage, carbon in result.all()
    ]
