from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core import security
from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import AuthResponse, OTPRequest, OTPVerify, UserResponse
from app.services import auth_service, messaging_service, outbox_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/otp/request")
async def request_otp(
    payload: OTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Store/reuse the code synchronously (fast, DB-only)...
    user, otp, retry_after = await auth_service.request_otp(db, payload)

    # ...then deliver the SMS *after* the response. This is the whole point: the
    # client never waits on the SMS provider. If the provider is slow, unreachable
    # or not yet configured, the message is retried from the durable outbox.
    sms_scheduled = False
    if retry_after == 0 and (messaging_service.is_configured() or settings.sms_enabled):
        background_tasks.add_task(
            outbox_service.send_now_or_enqueue,
            user.phone_number,
            f"InteliScrap OTP: {otp}",
            event_type="sms.otp",
            aggregate_type="auth",
            aggregate_id=user.id,
        )
        sms_scheduled = True

    return {
        "status": "sent",
        # Only expose the code itself in debug/demo mode; in production it is
        # delivered by SMS alone.
        "otp": otp if settings.debug else None,
        "user_id": user.id,
        "retry_after": retry_after,
        "sms_scheduled": sms_scheduled,
    }


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
