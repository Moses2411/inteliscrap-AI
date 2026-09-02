from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MaterialCategory

DEFAULT_MATERIALS = [
    {"slug": "copper", "name": "Copper", "name_ha": "Tagulla", "name_pcm": "Copper wire", "grade": "Grade A", "price_per_kg_naira": 3200.00, "carbon_kg_co2e_per_kg": 2.60, "is_hazardous": False, "sort_order": 1},
    {"slug": "aluminum", "name": "Aluminum", "name_ha": "Aluminiyam", "name_pcm": "Aluminum", "grade": "Can Sheet", "price_per_kg_naira": 700.00, "carbon_kg_co2e_per_kg": 9.10, "is_hazardous": False, "sort_order": 2},
    {"slug": "pet-plastic", "name": "PET Plastic", "name_ha": "Robobi", "name_pcm": "PET bottle", "grade": None, "price_per_kg_naira": 180.00, "carbon_kg_co2e_per_kg": 1.50, "is_hazardous": False, "sort_order": 3},
    {"slug": "lead-battery", "name": "Lead-Acid Battery", "name_ha": "Batir", "name_pcm": "Lead battery", "grade": None, "price_per_kg_naira": 950.00, "carbon_kg_co2e_per_kg": 0.95, "is_hazardous": True, "sort_order": 4},
    {"slug": "brass", "name": "Brass", "name_ha": "Farin Karfe", "name_pcm": "Brass", "grade": "Grade A", "price_per_kg_naira": 2200.00, "carbon_kg_co2e_per_kg": 0.80, "is_hazardous": False, "sort_order": 5},
    {"slug": "steel", "name": "Steel", "name_ha": "Karfe", "name_pcm": "Iron scrap", "grade": None, "price_per_kg_naira": 90.00, "carbon_kg_co2e_per_kg": 1.80, "is_hazardous": False, "sort_order": 6},
    {"slug": "e-waste", "name": "E-Waste Board", "name_ha": "Na'ura", "name_pcm": "E-waste", "grade": None, "price_per_kg_naira": 400.00, "carbon_kg_co2e_per_kg": 0.60, "is_hazardous": True, "sort_order": 7},
    {"slug": "glass", "name": "Glass", "name_ha": "Gilashi", "name_pcm": "Glass", "grade": None, "price_per_kg_naira": 25.00, "carbon_kg_co2e_per_kg": 0.30, "is_hazardous": False, "sort_order": 8},
]


async def seed_material_categories(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(MaterialCategory))
    if result.scalar_one() > 0:
        return 0

    for data in DEFAULT_MATERIALS:
        db.add(MaterialCategory(**data))
    await db.flush()
    return len(DEFAULT_MATERIALS)
