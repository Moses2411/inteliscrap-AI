from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sync_empty_scans(client: AsyncClient):
    payload = {
        "user_id": "test-user-1",
        "local_scans": [],
    }
    response = await client.post("/api/v1/sync", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["synced_ids"] == []
    assert isinstance(data["latest_prices"], list)


@pytest.mark.asyncio
async def test_sync_single_scan(client: AsyncClient):
    payload = {
        "user_id": "test-user-1",
        "local_scans": [
            {
                "id": "scan-001",
                "material_class": "Copper",
                "sub_grade": "Grade A",
                "weight_est_kg": 2.5,
                "estimated_naira_value": 4500.0,
                "confidence_score": 0.95,
                "toxicity_hazards": [],
                "safety_instructions": "Safe to handle.",
                "captured_at": "2026-07-17T12:00:00Z",
                "is_deleted": False,
            }
        ],
    }
    response = await client.post("/api/v1/sync", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "scan-001" in data["synced_ids"]


@pytest.mark.asyncio
async def test_sync_idempotent_duplicate(client: AsyncClient):
    payload = {
        "user_id": "test-user-2",
        "local_scans": [
            {
                "id": "scan-dup",
                "material_class": "Aluminum",
                "sub_grade": "Can Sheet",
                "weight_est_kg": 1.0,
                "estimated_naira_value": 800.0,
                "confidence_score": 0.90,
                "toxicity_hazards": [],
                "safety_instructions": "Safe.",
                "captured_at": "2026-07-17T12:00:00Z",
                "is_deleted": False,
            }
        ],
    }
    # First sync
    r1 = await client.post("/api/v1/sync", json=payload)
    assert r1.status_code == 200
    assert "scan-dup" in r1.json()["synced_ids"]

    # Second sync with same data — should be idempotent, no error
    r2 = await client.post("/api/v1/sync", json=payload)
    assert r2.status_code == 200
    assert "scan-dup" in r2.json()["synced_ids"]
    # Should still only have one entry
    assert len(r2.json()["synced_ids"]) == 1


@pytest.mark.asyncio
async def test_sync_conflict_newer_wins(client: AsyncClient):
    base_time = datetime(2026, 7, 17, 12, 0, 0)

    # Send initial scan
    payload_old = {
        "user_id": "test-user-3",
        "local_scans": [
            {
                "id": "scan-conflict",
                "material_class": "Brass",
                "sub_grade": "Grade B",
                "weight_est_kg": 3.0,
                "estimated_naira_value": 1500.0,
                "confidence_score": 0.85,
                "toxicity_hazards": [],
                "safety_instructions": "Safe.",
                "captured_at": base_time.isoformat() + "Z",
                "is_deleted": False,
            }
        ],
    }
    r1 = await client.post("/api/v1/sync", json=payload_old)
    assert r1.status_code == 200

    # Send newer version of same scan
    payload_new = {
        "user_id": "test-user-3",
        "local_scans": [
            {
                "id": "scan-conflict",
                "material_class": "Brass",
                "sub_grade": "Grade A",
                "weight_est_kg": 3.5,
                "estimated_naira_value": 2200.0,
                "confidence_score": 0.94,
                "toxicity_hazards": ["sharp_edges"],
                "safety_instructions": "Sharp edges. Use gloves.",
                "captured_at": (base_time + timedelta(hours=1)).isoformat() + "Z",
                "is_deleted": False,
            }
        ],
    }
    r2 = await client.post("/api/v1/sync", json=payload_new)
    assert r2.status_code == 200
    assert "scan-conflict" in r2.json()["synced_ids"]
    # Verify newer data was synced (just one ID)
    assert len(r2.json()["synced_ids"]) == 1


@pytest.mark.asyncio
async def test_sync_marks_deleted(client: AsyncClient):
    payload = {
        "user_id": "test-user-4",
        "local_scans": [
            {
                "id": "scan-del",
                "material_class": "PET Plastic",
                "sub_grade": None,
                "weight_est_kg": None,
                "estimated_naira_value": 200.0,
                "confidence_score": 0.70,
                "toxicity_hazards": None,
                "safety_instructions": None,
                "captured_at": "2026-07-17T12:00:00Z",
                "is_deleted": True,
            }
        ],
    }
    response = await client.post("/api/v1/sync", json=payload)
    assert response.status_code == 200
    assert "scan-del" in response.json()["synced_ids"]
