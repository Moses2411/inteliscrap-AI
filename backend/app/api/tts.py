from urllib.parse import quote
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/api/v1", tags=["tts"])


@router.get("/tts")
async def text_to_speech(text: str, lang: str = "ha"):
    url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={quote(text)}&tl={lang}&client=tw-ob"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return Response(content=resp.content, media_type="audio/mpeg")
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="TTS service unavailable")
