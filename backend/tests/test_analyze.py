import json

import httpx
import pytest
from httpx import AsyncClient

from app.services import analyze_service
from app.services.analyze_service import (
    CANONICAL_MATERIALS,
    analyze_image,
    normalize_hazard,
    normalize_material,
    parse_and_validate,
)


# ---------------------------------------------------------------------------
# Pure normalisation helpers
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw, expected_slug",
    [
        ("Copper", "copper"),
        ("copper", "copper"),
        ("COPPER wire", "copper"),
        ("Aluminium", "aluminum"),
        ("PET Plastic", "pet-plastic"),
        ("pet", "pet-plastic"),
        ("HDPE Plastic", "pet-plastic"),
        ("Lead-Acid Battery", "lead-battery"),
        ("lead acid battery", "lead-battery"),
        ("Stainless Steel", "steel"),
        ("Computer motherboard", "e-waste"),
        ("Glass", "glass"),
    ],
)
def test_normalize_material_maps_aliases(raw, expected_slug):
    label, slug = normalize_material(raw)
    assert slug == expected_slug
    assert label == CANONICAL_MATERIALS[expected_slug]


def test_normalize_material_unknown_is_closed():
    label, slug = normalize_material("unobtanium-9000")
    assert (label, slug) == ("Unknown", "other")


def test_normalize_hazard_canonical_and_alias():
    assert normalize_hazard("lead_poisoning") == "lead_poisoning"
    assert normalize_hazard("Lead") == "lead_poisoning"
    assert normalize_hazard("sharp edges") == "sharp_edges"
    assert normalize_hazard("") is None
    assert normalize_hazard("!!!") is None


def test_normalize_hazard_sanitizes_unknown_but_keeps_info():
    value = normalize_hazard("weird hazard; DROP TABLE")
    assert value is not None
    assert all(c.isalnum() or c == "_" for c in value)


# ---------------------------------------------------------------------------
# parse_and_validate (model text -> API shape)
# ---------------------------------------------------------------------------

def test_parse_and_validate_happy_path():
    content = json.dumps(
        {
            "material_class": "Copper",
            "confidence": 0.87,
            "toxicity_hazards": ["sharp_edges"],
            "safety_instructions": "Wear gloves.",
        }
    )
    result = parse_and_validate(content)
    assert result["material_class"] == "Copper"
    assert result["material_slug"] == "copper"
    assert result["confidence"] == 0.87
    assert result["toxicity_hazards"] == ["sharp_edges"]
    assert result["safety_instructions"] == "Wear gloves."


def test_parse_and_validate_strips_markdown_fences():
    content = '```json\n{"material_class": "glass", "confidence": 0.5, "toxicity_hazards": [], "safety_instructions": "Careful."}\n```'
    result = parse_and_validate(content)
    assert result["material_slug"] == "glass"


def test_parse_and_validate_clamps_confidence():
    high = parse_and_validate(json.dumps(_payload(confidence=5.0)))
    low = parse_and_validate(json.dumps(_payload(confidence=-3.0)))
    assert high["confidence"] == 1.0
    assert low["confidence"] == 0.0


def test_parse_and_validate_unknown_material():
    result = parse_and_validate(json.dumps(_payload(material_class="Cool Rock")))
    assert result["material_class"] == "Unknown"
    assert result["material_slug"] == "other"


def test_parse_and_validate_dedupes_and_caps_hazards():
    result = parse_and_validate(
        json.dumps(_payload(toxicity_hazards=["Lead", "lead_poisoning"] + [f"custom_h{i}" for i in range(20)]))
    )
    assert result["toxicity_hazards"][0] == "lead_poisoning"
    assert len(result["toxicity_hazards"]) <= analyze_service.MAX_HAZARDS


def test_parse_and_validate_empty_safety_gets_default():
    result = parse_and_validate(json.dumps(_payload(safety_instructions="   ")))
    assert result["safety_instructions"] == analyze_service.DEFAULT_SAFETY


@pytest.mark.parametrize("bad", ["", "not json at all", "```\n{}\n``` is not enough"])
def test_parse_and_validate_rejects_garbage(bad):
    with pytest.raises(ValueError):
        parse_and_validate(bad)


def _payload(**overrides):
    base = {
        "material_class": "Steel",
        "confidence": 0.6,
        "toxicity_hazards": [],
        "safety_instructions": "Handle with care.",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# analyze_image retry behaviour
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_analyze_image_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    async def fake_call(image_base64, use_schema=True):
        calls["n"] += 1
        if calls["n"] == 1:
            raise httpx.ConnectError("boom")
        return json.dumps(_payload(material_class="Copper"))

    monkeypatch.setattr(analyze_service, "_call_ollama", fake_call)
    result = await analyze_image("a" * 40)
    assert result["material_slug"] == "copper"
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_analyze_image_raises_after_all_retries(monkeypatch):
    async def always_fail(image_base64, use_schema=True):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(analyze_service, "_call_ollama", always_fail)
    with pytest.raises(RuntimeError):
        await analyze_image("a" * 40)


@pytest.mark.asyncio
async def test_analyze_image_strips_data_url(monkeypatch):
    seen = {}

    async def fake_call(image_base64, use_schema=True):
        seen["image"] = image_base64
        return json.dumps(_payload())

    monkeypatch.setattr(analyze_service, "_call_ollama", fake_call)
    await analyze_image("data:image/png;base64," + "B" * 40)
    assert not seen["image"].startswith("data:")


@pytest.mark.asyncio
async def test_analyze_image_rejects_tiny_payload():
    with pytest.raises(RuntimeError):
        await analyze_image("abc")


# ---------------------------------------------------------------------------
# API endpoint contract
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_analyze_endpoint_happy_path(client: AsyncClient, monkeypatch):
    async def fake_call(image_base64, use_schema=True):
        return json.dumps(_payload(material_class="Copper", confidence=0.9))

    monkeypatch.setattr(analyze_service, "_call_ollama", fake_call)
    resp = await client.post("/api/v1/analyze", json={"image_base64": "A" * 64})
    assert resp.status_code == 200
    body = resp.json()
    assert body["material_class"] == "Copper"
    assert body["material_slug"] == "copper"
    assert body["confidence"] == 0.9


@pytest.mark.asyncio
async def test_analyze_endpoint_returns_502_when_model_down(client: AsyncClient, monkeypatch):
    async def always_fail(image_base64, use_schema=True):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(analyze_service, "_call_ollama", always_fail)
    resp = await client.post("/api/v1/analyze", json={"image_base64": "A" * 64})
    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_analyze_endpoint_rejects_short_image(client: AsyncClient):
    resp = await client.post("/api/v1/analyze", json={"image_base64": "short"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_endpoint_503_when_disabled(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(analyze_service.settings, "enable_server_vision", False)
    resp = await client.post("/api/v1/analyze", json={"image_base64": "A" * 64})
    assert resp.status_code == 503
