from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import AuthResponse, OTPRequest, OTPVerify, UserResponse
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/otp/request")
async def request_otp(payload: OTPRequest, db: AsyncSession = Depends(get_db)):
    user, otp = await auth_service.request_otp(db, payload)
    return {"status": "sent", "otp": otp, "user_id": user.id}


@router.post("/otp/verify", response_model=AuthResponse)
async def verify_otp(payload: OTPVerify, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.verify_otp(db, payload.phone_number, payload.otp_code)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    token = security.create_access_token(user.id, user.role.value)
    return AuthResponse(access_token=token, user_id=user.id, role=user.role.value)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user
