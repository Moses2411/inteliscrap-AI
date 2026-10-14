"""Impact aggregation.

Source-of-truth policy: when real settled transactions exist, impact is computed
**live** from the settlement ledger (the same records the EPR compliance
manifesto reads). Only when there are no settlements does the service fall back
to pre-aggregated ``ngo_impact_logs`` (used by demo/seed data). Every response
carries ``computed_from`` so consumers can tell which path produced it.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MaterialCategory, NGOImpactLog, Transaction, TransactionStatus


async def _settled_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.status == TransactionStatus.settled)
    )
    return int(result.scalar() or 0)


async def get_summary(db: AsyncSession) -> dict:
    settled = await _settled_count(db)

    if settled > 0:
        result = await db.execute(
            select(
                func.coalesce(func.sum(Transaction.weight_kg), 0),
                func.coalesce(
                    func.sum(Transaction.weight_kg * MaterialCategory.carbon_kg_co2e_per_kg), 0
                ),
                func.coalesce(func.sum(Transaction.collector_earnings_naira), 0),
                func.coalesce(func.sum(Transaction.platform_fee_naira), 0),
                func.coalesce(func.sum(Transaction.seller_payout_naira), 0),
            )
            .join(MaterialCategory, Transaction.material_category_id == MaterialCategory.id)
            .where(Transaction.status == TransactionStatus.settled)
        )
        tonnage, carbon, income, platform_fee, seller_payout = result.one()
        return {
            "total_tonnage_kg": float(tonnage),
            "total_carbon_offset_kg_co2e": float(carbon),
            "total_collector_income_naira": float(income),
            "transactions_count": settled,
            "total_transactions": settled,
            "computed_from": "settlements",
            "platform_revenue_naira": float(platform_fee),
            "seller_payout_naira": float(seller_payout),
        }

    # Fallback: demo / pre-aggregated impact logs
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
        "total_transactions": int(count),
        "computed_from": "ngo_impact_logs",
        "platform_revenue_naira": 0.0,
        "seller_payout_naira": 0.0,
    }


async def get_daily(db: AsyncSession) -> list[dict]:
    if await _settled_count(db) > 0:
        # Aggregate in Python to stay dialect-agnostic (SQLite stores datetimes as text).
        result = await db.execute(
            select(
                Transaction.settled_at,
                Transaction.weight_kg,
                Transaction.weight_kg * MaterialCategory.carbon_kg_co2e_per_kg,
                Transaction.collector_earnings_naira,
            )
            .join(MaterialCategory, Transaction.material_category_id == MaterialCategory.id)
            .where(
                Transaction.status == TransactionStatus.settled,
                Transaction.settled_at.is_not(None),
            )
        )
        buckets: dict[str, dict] = {}
        for settled_at, weight, carbon, income in result.all():
            period = settled_at.strftime("%Y-%m-%d") if settled_at else "unknown"
            bucket = buckets.setdefault(
                period,
                {"tonnage_kg": 0.0, "carbon_offset_kg_co2e": 0.0, "collector_income_naira": 0.0},
            )
            bucket["tonnage_kg"] += float(weight or 0)
            bucket["carbon_offset_kg_co2e"] += float(carbon or 0)
            bucket["collector_income_naira"] += float(income or 0)
        return [
            {"period": period, **bucket}
            for period, bucket in sorted(buckets.items())
        ]

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
    if await _settled_count(db) > 0:
        result = await db.execute(
            select(
                MaterialCategory.name,
                func.coalesce(func.sum(Transaction.weight_kg), 0),
                func.coalesce(
                    func.sum(Transaction.weight_kg * MaterialCategory.carbon_kg_co2e_per_kg), 0
                ),
                func.coalesce(func.sum(Transaction.collector_earnings_naira), 0),
            )
            .join(MaterialCategory, Transaction.material_category_id == MaterialCategory.id)
            .where(Transaction.status == TransactionStatus.settled)
            .group_by(MaterialCategory.name)
            .order_by(func.sum(Transaction.weight_kg).desc())
        )
        return [
            {
                "material": name,
                "tonnage_kg": float(tonnage),
                "carbon_offset_kg_co2e": float(carbon),
                "collector_income_naira": float(income),
            }
            for name, tonnage, carbon, income in result.all()
        ]

    result = await db.execute(
        select(
            MaterialCategory.name,
            func.sum(NGOImpactLog.tonnage_kg),
            func.sum(NGOImpactLog.carbon_offset_kg_co2e),
            func.sum(NGOImpactLog.collector_income_naira),
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
            "collector_income_naira": float(income),
        }
        for name, tonnage, carbon, income in result.all()
    ]
