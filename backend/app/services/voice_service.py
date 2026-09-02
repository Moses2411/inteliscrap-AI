from urllib.parse import quote

import httpx

from app.config import settings

GOOGLE_TTS_URL = "https://translate.google.com/translate_tts"


async def synthesize(text: str, lang: str = "ha") -> bytes:
    if settings.voice_tts_url:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                settings.voice_tts_url,
                json={"text": text, "lang": lang},
            )
            resp.raise_for_status()
            return resp.content

    url = f"{GOOGLE_TTS_URL}?ie=UTF-8&q={quote(text)}&tl={lang}&client=tw-ob"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


async def transcribe(audio_bytes: bytes, lang: str = "ha") -> str:
    if not settings.voice_asr_url:
        raise RuntimeError("Voice ASR endpoint is not configured")

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            settings.voice_asr_url,
            content=audio_bytes,
            headers={"Content-Type": "audio/wav"},
            params={"lang": lang},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("text", "")
