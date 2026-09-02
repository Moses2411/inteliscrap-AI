from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core import security
from app.models import User, UserRole
from app.schemas import OTPRequest
from app.services import messaging_service, user_service


async def request_otp(db: AsyncSession, payload: OTPRequest) -> tuple[User, str | None]:
    user = await user_service.get_by_phone(db, payload.phone_number)
    if user is None:
        user = User(
            phone_number=payload.phone_number,
            role=payload.role or UserRole.household,
            full_name=payload.full_name,
        )
        db.add(user)
        await db.flush()

    otp = security.generate_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(seconds=settings.otp_expire_seconds)
    await db.flush()

    try:
        await messaging_service.send_sms(user.phone_number, f"InteliScrap OTP: {otp}")
    except Exception:
        pass

    return user, (otp if settings.debug else None)


async def verify_otp(db: AsyncSession, phone_number: str, otp_code: str) -> User:
    user = await user_service.get_by_phone(db, phone_number)
    if user is None:
        raise ValueError("User not found")

    if (
        not user.otp_code
        or user.otp_code != otp_code
        or user.otp_expires_at is None
        or user.otp_expires_at < datetime.utcnow()
    ):
        raise ValueError("Invalid or expired OTP")

    user.otp_code = None
    user.otp_expires_at = None
    user.is_verified = True
    await db.flush()
    return user
