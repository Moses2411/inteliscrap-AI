import base64
import json
from fastapi import APIRouter, HTTPException
from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.analyze_service import analyze_image

router = APIRouter(prefix="/api/v1", tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_scrap(payload: AnalyzeRequest):
    try:
        result = await analyze_image(payload.image_base64)
        return AnalyzeResponse(
            material_class=result.get("material_class", "Unknown"),
            confidence=result.get("confidence", 0.0),
            toxicity_hazards=result.get("toxicity_hazards", []),
            safety_instructions=result.get("safety_instructions", "Handle with care."),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
