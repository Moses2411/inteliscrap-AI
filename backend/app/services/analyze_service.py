"""Server-side vision analysis via Ollama (llava).

This is the *online* fallback when the on-device classifier is unavailable. It
must never let raw model text reach the client: everything is parsed, validated
against a fixed schema, and normalised to a closed set of material slugs and
sanitised hazard keys. If the model returns anything unexpected we fail loudly
(HTTP 502) so the client can fall back to the heuristic / manual picker rather
than showing a fabricated answer.
"""

import json
import re

import httpx
from pydantic import BaseModel, ValidationError, field_validator

from app.config import settings

# ---------------------------------------------------------------------------
# Closed vocabularies (must stay in sync with frontend/public/models/classes.json)
# ---------------------------------------------------------------------------

# slug -> canonical display label
CANONICAL_MATERIALS: dict[str, str] = {
    "copper": "Copper",
    "aluminum": "Aluminum",
    "pet-plastic": "PET Plastic",
    "lead-battery": "Lead-Acid Battery",
    "brass": "Brass",
    "steel": "Steel",
    "e-waste": "E-Waste Board",
    "glass": "Glass",
}

UNKNOWN_MATERIAL = "Unknown"

# normalised alias -> canonical slug
MATERIAL_ALIASES: dict[str, str] = {
    "copper": "copper",
    "aluminum": "aluminum",
    "aluminium": "aluminum",
    "metal": "other",
    "pet plastic": "pet-plastic",
    "pet": "pet-plastic",
    "plastic bottle": "pet-plastic",
    "hdpe plastic": "pet-plastic",
    "ldpe plastic": "pet-plastic",
    "polypropylene": "pet-plastic",
    "pp": "pet-plastic",
    "pvc": "pet-plastic",
    "lead acid battery": "lead-battery",
    "lead battery": "lead-battery",
    "battery": "lead-battery",
    "brass": "brass",
    "steel": "steel",
    "stainless steel": "steel",
    "iron": "steel",
    "e waste board": "e-waste",
    "e waste": "e-waste",
    "ewaste": "e-waste",
    "electronic waste": "e-waste",
    "pcb": "e-waste",
    "motherboard": "e-waste",
    "computer motherboard": "e-waste",
    "circuit board": "e-waste",
    "glass": "glass",
}

# hazard slug -> nothing; this is the closed set the UI can render.
KNOWN_HAZARDS = frozenset(
    {
        "corrosive_acid",
        "lead_poisoning",
        "mercury_exposure",
        "lithium_fire_risk",
        "cadmium_toxicity",
        "asbestos_fibers",
        "hydrocarbon_contamination",
        "sharp_edges",
        "explosive_gas",
        "chemical_burns",
        "arsenic_compound",
        "chromium_contamination",
        "refrigerant_gas",
        "pcb_contamination",
        "biological_waste",
    }
)

HAZARD_ALIASES: dict[str, str] = {
    "lead": "lead_poisoning",
    "acid": "corrosive_acid",
    "battery_acid": "corrosive_acid",
    "corrosive": "corrosive_acid",
    "mercury": "mercury_exposure",
    "lithium": "lithium_fire_risk",
    "fire": "lithium_fire_risk",
    "asbestos": "asbestos_fibers",
    "sharp": "sharp_edges",
    "pcb": "pcb_contamination",
    "bio": "biological_waste",
    "oil": "hydrocarbon_contamination",
    "fuel": "hydrocarbon_contamination",
}

DEFAULT_SAFETY = "Handle with care."

SYSTEM_PROMPT = (
    "You are a materials expert for informal waste recycling in Northern Nigeria.\n"
    "Look at the scrap material in the image and reply with JSON only, no markdown, "
    "with exactly these fields:\n"
    "- material_class: exactly one of "
    f"{', '.join(CANONICAL_MATERIALS.values())}, or \"{UNKNOWN_MATERIAL}\" if you are not sure.\n"
    "- confidence: a number from 0.0 to 1.0 (your honest certainty).\n"
    "- toxicity_hazards: an array of hazard tags using these when relevant: "
    f"{', '.join(sorted(KNOWN_HAZARDS))}. Use an empty array when there is no hazard.\n"
    "- safety_instructions: one short, plain-language safety sentence.\n"
    "Never invent a material outside the list. If unsure, choose "
    f"\"{UNKNOWN_MATERIAL}\" and a low confidence."
)

# JSON schema handed to Ollama so the model is constrained to our shape.
ANALYZE_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "material_class": {
            "type": "string",
            "enum": sorted([*CANONICAL_MATERIALS.values(), UNKNOWN_MATERIAL]),
        },
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "toxicity_hazards": {"type": "array", "items": {"type": "string"}},
        "safety_instructions": {"type": "string"},
    },
    "required": ["material_class", "confidence", "toxicity_hazards", "safety_instructions"],
}

MAX_HAZARDS = 8
MAX_SAFETY_LEN = 300
_DATA_URL_RE = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,", re.IGNORECASE)
_ALLOWED_HAZARD_RE = re.compile(r"[^a-z0-9_]")
_ALLOWED_LABEL_RE = re.compile(r"[^a-z0-9 ]")


class _RawVisionResult(BaseModel):
    """Validated shape of the model's JSON before normalisation."""

    material_class: str
    confidence: float = 0.0
    toxicity_hazards: list[str] = []
    safety_instructions: str = DEFAULT_SAFETY

    @field_validator("toxicity_hazards", mode="before")
    @classmethod
    def _coerce_hazards(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [str(item) for item in value if item is not None]
        return []

    @field_validator("safety_instructions", mode="before")
    @classmethod
    def _coerce_safety(cls, value):
        return "" if value is None else str(value)


def _normalize_text(value: object) -> str:
    """Lowercase, strip punctuation noise and collapse whitespace."""
    text = str(value).strip().lower().replace("-", " ").replace("/", " ").replace("_", " ")
    text = _ALLOWED_LABEL_RE.sub(" ", text)
    return " ".join(text.split())


def normalize_material(raw: object) -> tuple[str, str]:
    """Return (canonical label, slug) for a model-provided material string."""
    key = _normalize_text(raw)
    slug = MATERIAL_ALIASES.get(key, "")
    if not slug:
        for alias, candidate in MATERIAL_ALIASES.items():
            if alias and alias in key:
                slug = candidate
                break
    if slug in CANONICAL_MATERIALS:
        return CANONICAL_MATERIALS[slug], slug
    return UNKNOWN_MATERIAL, "other"


def normalize_hazard(raw: object) -> str | None:
    """Return a sanitised hazard slug, or None when nothing usable remains."""
    key = _normalize_text(raw).replace(" ", "_")
    if not key:
        return None
    key = _ALLOWED_HAZARD_RE.sub("", key)[:40]
    if not key:
        return None
    if key in HAZARD_ALIASES:
        return HAZARD_ALIASES[key]
    if key in KNOWN_HAZARDS:
        return key
    return key


def _strip_data_url(image_base64: str) -> str:
    return _DATA_URL_RE.sub("", image_base64.strip())


def _extract_json(content: str) -> dict:
    """Pull a JSON object out of the model text, tolerating code fences."""
    if not content or not content.strip():
        raise ValueError("empty model response")
    text = content.strip()
    # Drop ```json ... ``` fences if present.
    if text.startswith("```"):
        text = text.strip("`")
        if text[:4].lower() == "json":
            text = text[4:]
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no JSON object found in model response")
    return json.loads(text[start : end + 1])


def parse_and_validate(content: str) -> dict:
    """Validate + normalise a raw model response into the API shape."""
    data = _extract_json(content)
    try:
        raw = _RawVisionResult.model_validate(data)
    except ValidationError as exc:  # pragma: no cover - defensive
        raise ValueError(f"model JSON failed validation: {exc}") from exc

    label, slug = normalize_material(raw.material_class)

    confidence = float(raw.confidence)
    if confidence != confidence:  # NaN guard
        confidence = 0.0
    confidence = min(1.0, max(0.0, confidence))

    hazards: list[str] = []
    for item in raw.toxicity_hazards:
        normalized = normalize_hazard(item)
        if normalized and normalized not in hazards:
            hazards.append(normalized)
        if len(hazards) >= MAX_HAZARDS:
            break

    safety = raw.safety_instructions.strip()[:MAX_SAFETY_LEN] or DEFAULT_SAFETY

    return {
        "material_class": label,
        "material_slug": slug,
        "confidence": round(confidence, 3),
        "toxicity_hazards": hazards,
        "safety_instructions": safety,
    }


async def _call_ollama(image_base64: str, use_schema: bool = True) -> str:
    """POST to Ollama and return the raw response text.

    Falls back from the structured JSON schema to plain ``format: "json"`` if the
    running Ollama version rejects the schema.
    """
    payload = {
        "model": settings.ollama_vision_model,
        "system": SYSTEM_PROMPT,
        "prompt": "Classify this scrap material and identify any hazards.",
        "images": [image_base64],
        "stream": False,
        "format": ANALYZE_SCHEMA if use_schema else "json",
        "options": {"temperature": 0.1, "num_predict": 512},
    }

    async with httpx.AsyncClient(timeout=settings.ollama_timeout_s) as client:
        resp = await client.post(f"{settings.ollama_base_url}/api/generate", json=payload)
        if resp.status_code == 400 and use_schema:
            # Older Ollama builds don't accept a JSON schema in `format`.
            return await _call_ollama(image_base64, use_schema=False)
        resp.raise_for_status()
        return resp.json().get("response", "")


async def analyze_image(image_base64: str) -> dict:
    """Analyse an image, retrying transient failures, and return a normalised dict.

    Raises RuntimeError so the API layer can respond 502 and the client can fall
    back to the on-device heuristic rather than trusting an unvalidated answer.
    """
    cleaned = _strip_data_url(image_base64)
    if len(cleaned) < 16:
        raise RuntimeError("image data is missing or too small")

    attempts = max(1, settings.ollama_max_retries)
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            content = await _call_ollama(cleaned)
            return parse_and_validate(content)
        except httpx.HTTPError as exc:
            last_error = exc
        except ValueError as exc:
            last_error = exc

    raise RuntimeError(f"Vision model unavailable: {last_error}")
