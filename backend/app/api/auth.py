from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import (
    AuthResponse,
    OTPRequest,
    OTPVerify,
    PasswordLogin,
    PasswordRegister,
    RefreshRequest,
    UserResponse,
)
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

    access_token, refresh_token = await auth_service.issue_token_pair(db, user)
    return AuthResponse(
        access_token=access_token, refresh_token=refresh_token, user_id=user.id, role=user.role.value
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: PasswordRegister, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.register_with_password(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    access_token, refresh_token = await auth_service.issue_token_pair(db, user)
    return AuthResponse(
        access_token=access_token, refresh_token=refresh_token, user_id=user.id, role=user.role.value
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: PasswordLogin, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.login_with_password(db, payload.phone_number, payload.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    access_token, refresh_token = await auth_service.issue_token_pair(db, user)
    return AuthResponse(
        access_token=access_token, refresh_token=refresh_token, user_id=user.id, role=user.role.value
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        user, access_token, refresh_token = await auth_service.rotate_refresh_token(
            db, payload.refresh_token
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return AuthResponse(
        access_token=access_token, refresh_token=refresh_token, user_id=user.id, role=user.role.value
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.revoke_refresh_token(db, payload.refresh_token)
    return None


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user
