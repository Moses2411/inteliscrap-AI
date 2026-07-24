import json
import httpx

OLLAMA_BASE_URL = "http://localhost:11434"
GEMMA_MODEL = "gemma4:e2b"

SYSTEM_PROMPT = """You are a materials expert for waste recycling in Northern Nigeria.
Analyze the scrap material shown in the image and return ONLY valid JSON with these fields:
- material_class: string (one of: Copper, Aluminum, Lead-Acid Battery, Lithium-Ion Cell, Brass, Steel, Stainless Steel, HDPE Plastic, LDPE Plastic, PET Plastic, Polypropylene, PVC, Glass, E-Waste Board, Transformer, Rubber, Textile, Mixed Scrap, computer motherboard, sanitry pads, local traps)
- confidence: float (0.0 to 1.0)
- toxicity_hazards: array of strings
- safety_instructions: string (one short sentence)

Output JSON only. No markdown, no extra text."""


async def analyze_image(image_base64: str) -> dict:
    payload = {
        "model": GEMMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": "Classify this scrap material and identify any hazards.",
                "images": [image_base64],
            },
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1, "max_tokens": 512},
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data.get("message", {}).get("content", "")
            return json.loads(content)
        except httpx.HTTPError as e:
            raise RuntimeError(f"Ollama request failed: {e}")
        except (KeyError, json.JSONDecodeError) as e:
            raise RuntimeError(f"Ollama returned invalid response: {e}")
