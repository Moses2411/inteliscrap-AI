from fastapi import APIRouter, Depends, Form
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import ussd_handler

router = APIRouter(prefix="/api/v1/ussd", tags=["ussd"])


@router.post("/callback", response_class=PlainTextResponse)
async def ussd_callback(
    session_id: str = Form(..., alias="sessionId"),
    service_code: str = Form(..., alias="serviceCode"),
    phone_number: str = Form(..., alias="phoneNumber"),
    text: str = Form("", alias="text"),
    db: AsyncSession = Depends(get_db),
):
    return await ussd_handler.process_ussd(db, phone_number, text)
