from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CompliancePartner,
    MaterialCategory,
    NGOImpactLog,
    Transaction,
    User,
)


async def get_partner_by_api_key(
    db: AsyncSession, api_key: str
) -> CompliancePartner | None:
    return (
        await db.execute(
            select(CompliancePartner).where(CompliancePartner.api_key == api_key)
        )
    ).scalar_one_or_none()


async def generate_manifesto(
    db: AsyncSession,
    partner: CompliancePartner,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    if date_from is None:
        date_from = date.today().replace(day=1)
    if date_to is None:
        date_to = date.today()

    stmt = (
        select(Transaction, MaterialCategory.slug, MaterialCategory.name)
        .join(MaterialCategory, Transaction.material_category_id == MaterialCategory.id)
        .where(
            Transaction.status == "settled",
            Transaction.settled_at >= datetime.combine(date_from, datetime.min.time()),
            Transaction.settled_at <= datetime.combine(date_to, datetime.max.time()),
        )
        .order_by(Transaction.settled_at.desc())
    )
    if partner.brand_id is not None:
        # Producer scope: attribution rule — only transactions carrying this
        # producer's own brand (server-side brand_id, never client-supplied)
        # appear in the manifesto. Other producers' flows never leave the
        # server.
        stmt = stmt.where(Transaction.brand_id == partner.brand_id)
    rows = (await db.execute(stmt)).all()

    items = []
    total_weight = 0.0
    total_carbon = 0.0
    total_income = 0.0

    for txn, mat_slug, mat_name in rows:
        collector = await db.get(User, txn.collector_id)
        hub_name = None
        if txn.pickup_id:
            impact_row = (
                await db.execute(
                    select(NGOImpactLog).where(NGOImpactLog.transaction_id == txn.id)
                )
            ).scalar_one_or_none()
            if impact_row:
                hub_name = impact_row.hub

        w = float(txn.weight_kg)
        co = w * 2.6
        total_weight += w
        total_carbon += co
        total_income += float(txn.collector_earnings_naira)

        seller = await db.get(User, txn.seller_id)
        items.append(
            {
                "transaction_id": txn.id,
                "collector_id": txn.collector_id,
                "collector_phone": collector.phone_number if collector else "",
                "seller_id": txn.seller_id,
                "seller_phone": seller.phone_number if seller else "",
                "material_slug": mat_slug,
                "material_name": mat_name,
                "weight_kg": w,
                "gross_value_naira": float(txn.gross_value_naira),
                "carbon_offset_kg_co2e": co,
                "hub": hub_name,
                "settled_at": txn.settled_at.isoformat() if txn.settled_at else None,
            }
        )

    return {
        "partner_id": partner.id,
        "partner_name": partner.name,
        "partner_type": partner.partner_type,
        "generated_at": datetime.utcnow().isoformat(),
        "total_transactions": len(items),
        "total_tonnage_kg": total_weight,
        "total_carbon_offset_kg_co2e": total_carbon,
        "total_collector_income_naira": total_income,
        "items": items,
    }


async def create_partner(
    db: AsyncSession, name: str, partner_type: str, api_key: str
) -> CompliancePartner:
    partner = CompliancePartner(
        name=name, partner_type=partner_type, api_key=api_key
    )
    db.add(partner)
    await db.flush()
    return partner
