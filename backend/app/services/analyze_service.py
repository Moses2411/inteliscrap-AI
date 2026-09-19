import json

import httpx

from app.config import settings

SYSTEM_PROMPT = (
    "You are a materials expert for waste recycling in Northern Nigeria.\n"
    "Analyze the scrap material shown in the image and return ONLY valid JSON with these fields:\n"
    "- material_class: string (one of: Copper, Aluminum, Lead-Acid Battery, Lithium-Ion Cell, "
    "Brass, Steel, Stainless Steel, HDPE Plastic, LDPE Plastic, PET Plastic, Polypropylene, PVC, "
    "Glass, E-Waste Board, Transformer, Rubber, Textile, Mixed Scrap, computer motherboard, "
    "sanitry pads, local traps)\n"
    "- confidence: float (0.0 to 1.0)\n"
    "- toxicity_hazards: array of strings\n"
    "- safety_instructions: string (one short sentence)\n\n"
    "Output JSON only. No markdown, no extra text."
)


async def analyze_image(image_base64: str) -> dict:
    payload = {
        "model": settings.ollama_vision_model,
        "system": SYSTEM_PROMPT,
        "prompt": "Classify this scrap material and identify any hazards.",
        "images": [image_base64],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1, "max_tokens": 512},
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(f"{settings.ollama_base_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data.get("response", "")
            return json.loads(content)
        except httpx.HTTPError as e:
            raise RuntimeError(f"Ollama request failed: {e}")
        except (KeyError, json.JSONDecodeError) as e:
            raise RuntimeError(f"Ollama returned invalid response: {e}")
