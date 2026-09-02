from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import ivr_handler, voice_service

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])


@router.post("/callback")
async def voice_callback(request: Request, db: AsyncSession = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        params = await request.json()
    else:
        form = await request.form()
        params = dict(form)
    return await ivr_handler.handle_voice(db, params)


@router.get("/audio")
async def voice_audio(text: str, lang: str = "ha"):
    try:
        audio = await voice_service.synthesize(text, lang)
    except Exception:
        raise HTTPException(status_code=502, detail="TTS service unavailable")
    return Response(content=audio, media_type="audio/mpeg")
