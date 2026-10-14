from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.analyze_service import analyze_image

router = APIRouter(prefix="/api/v1", tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_scrap(payload: AnalyzeRequest):
    if not settings.enable_server_vision:
        raise HTTPException(status_code=503, detail="Server vision is disabled")

    try:
        result = await analyze_image(payload.image_base64)
    except RuntimeError as exc:
        # The client falls back to the on-device heuristic or the manual picker.
        raise HTTPException(status_code=502, detail=str(exc))

    return AnalyzeResponse(
        material_class=result.get("material_class", "Unknown"),
        material_slug=result.get("material_slug", "other"),
        confidence=result.get("confidence", 0.0),
        toxicity_hazards=result.get("toxicity_hazards", []),
        safety_instructions=result.get("safety_instructions", "Handle with care."),
    )
