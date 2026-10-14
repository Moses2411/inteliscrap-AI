from datetime import datetime, timedelta

import pytest

from app.core import security
from app.models import MaterialCategory, PriceHistory, User, UserRole


async def _admin_headers(test_session, user_id="price-admin", phone="+2348090000001"):
    admin = User(
        id=user_id,
        phone_number=phone,
        role=UserRole.admin,
        is_verified=True,
    )
    test_session.add(admin)
    await test_session.flush()
    token = security.create_access_token(admin.id, admin.role.value)
    return {"Authorization": f"Bearer {token}"}


async def _material(test_session, slug="copper", name="Copper", price=3200.0, stale=False):
    material = MaterialCategory(
        slug=slug,
        name=name,
        price_per_kg_naira=price,
        carbon_kg_co2e_per_kg=2.6,
        price_last_updated_at=(
            datetime.utcnow() - timedelta(days=30) if stale else datetime.utcnow()
        ),
        price_source="seed",
        price_version=1,
    )
    test_session.add(material)
    await test_session.flush()
    return material


@pytest.mark.asyncio
async def test_list_prices_returns_canonical_materials(client, test_session):
    await _material(test_session, slug="copper", price=3300.0)
    resp = await client.get("/api/v1/prices/")
    assert resp.status_code == 200
    body = resp.json()
    assert any(item["material_class"] == "copper" for item in body)
    entry = next(item for item in body if item["material_class"] == "copper")
    assert entry["price_per_kg_naira"] == 3300.0
    assert entry["price_source"] == "seed"
    assert entry["is_stale"] is False
    assert entry["price_last_updated_at"] is not None


@pytest.mark.asyncio
async def test_update_price_requires_auth(client, test_session):
    await _material(test_session)
    resp = await client.put("/api/v1/prices/copper", json={"price_per_kg_naira": 4000})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_price_requires_reason(client, test_session):
    await _material(test_session)
    headers = await _admin_headers(test_session)
    resp = await client.put(
        "/api/v1/prices/copper",
        json={"price_per_kg_naira": 4000},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "reason" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_price_versions_and_audits(client, test_session):
    material = await _material(test_session, slug="copper", price=3200.0)
    headers = await _admin_headers(test_session)

    resp = await client.put(
        "/api/v1/prices/copper",
        json={"price_per_kg_naira": 4000, "reason": "LME copper up; Zaria hub bid raised"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["price_per_kg_naira"] == 4000.0
    assert body["price_version"] == 2
    assert body["price_source"] == "admin"
    assert body["is_stale"] is False

    history = (
        await test_session.execute(
            PriceHistory.__table__.select().where(
                PriceHistory.material_category_id == material.id
            )
        )
    ).all()
    assert len(history) == 1


@pytest.mark.asyncio
async def test_update_price_rejects_non_positive(client, test_session):
    await _material(test_session)
    headers = await _admin_headers(test_session)
    resp = await client.put(
        "/api/v1/prices/copper",
        json={"price_per_kg_naira": 0, "reason": "typo"},
        headers=headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_stale_flag_reflects_age(client, test_session):
    await _material(test_session, slug="glass", name="Glass", price=25.0, stale=True)
    resp = await client.get("/api/v1/prices/")
    assert resp.status_code == 200
    entry = next(item for item in resp.json() if item["material_class"] == "glass")
    assert entry["is_stale"] is True


@pytest.mark.asyncio
async def test_price_history_requires_role(client, test_session):
    await _material(test_session)
    resp = await client.get("/api/v1/prices/copper/history")
    assert resp.status_code == 401
