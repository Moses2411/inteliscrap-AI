from datetime import datetime
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import PriceMatrix, ScrapScan
from app.schemas import ScrapScanCreate


def _resolve_conflict(existing: ScrapScan, incoming: ScrapScanCreate) -> bool:
    existing_t = existing.captured_at.replace(tzinfo=None)
    incoming_t = incoming.captured_at.replace(tzinfo=None)
    return incoming_t > existing_t


async def process_scans(db: AsyncSession, user_id: str, scans: list[ScrapScanCreate]) -> list[str]:
    synced_ids: list[str] = []

    for client_scan in scans:
        result = await db.execute(
            select(ScrapScan).where(ScrapScan.id == client_scan.id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            if _resolve_conflict(existing, client_scan):
                existing.material_class = client_scan.material_class
                existing.sub_grade = client_scan.sub_grade
                existing.weight_est_kg = client_scan.weight_est_kg
                existing.estimated_naira_value = client_scan.estimated_naira_value
                existing.confidence_score = client_scan.confidence_score
                existing.toxicity_hazards = client_scan.toxicity_hazards
                existing.safety_instructions = client_scan.safety_instructions
                existing.captured_at = client_scan.captured_at
                existing.is_deleted = client_scan.is_deleted
            synced_ids.append(existing.id)
        else:
            new_scan = ScrapScan(
                id=client_scan.id,
                user_id=user_id,
                material_class=client_scan.material_class,
                sub_grade=client_scan.sub_grade,
                weight_est_kg=client_scan.weight_est_kg,
                estimated_naira_value=client_scan.estimated_naira_value,
                confidence_score=client_scan.confidence_score,
                toxicity_hazards=client_scan.toxicity_hazards,
                safety_instructions=client_scan.safety_instructions,
                captured_at=client_scan.captured_at,
                is_deleted=client_scan.is_deleted,
            )
            db.add(new_scan)
            synced_ids.append(new_scan.id)

    await db.flush()
    return synced_ids


async def get_latest_prices(db: AsyncSession) -> list[PriceMatrix]:
    result = await db.execute(select(PriceMatrix))
    return list(result.scalars().all())
