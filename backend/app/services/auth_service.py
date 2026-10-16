import math
import secrets
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core import security
from app.models import User, UserRole
from app.schemas import OTPRequest
from app.services import user_service

# A code stays valid for `settings.otp_expire_seconds` (10 min by default). A
# resend within this window re-sends the *same* code rather than minting a new one,
# so a user can never end up holding two codes where only the older one works.
# Rapid re-taps are additionally throttled for this many seconds.
OTP_RESEND_COOLDOWN_SECONDS = 30


def _safe_equal(a: str | None, b: str) -> bool:
    """Constant-time string compare that never raises on odd client input."""
    if not a:
        return False
    try:
        return secrets.compare_digest(a, b)
    except TypeError:  # non-ASCII input
        return False


async def request_otp(db: AsyncSession, payload: OTPRequest) -> tuple[User, str, int, bool]:
    """Create/reuse an OTP for a phone number and return ``(user, otp, retry_after, account_exists)``.

    This function deliberately performs **no network I/O** — it only touches the
    database. The caller is responsible for actually delivering the SMS (off the
    request path), so the HTTP request returns immediately even when the SMS
    provider is slow or unreachable.

    ``retry_after`` is > 0 when the caller should NOT send a message yet (a code
    was issued moments ago); the existing code is returned unchanged in that case.

    A phone number is bound to exactly one account type. ``payload.role`` only
    applies when the account is first created; for an existing account it is
    ignored so a user can never switch roles by signing in again.
    """
    user = await user_service.get_by_phone(db, payload.phone_number)
    account_exists = user is not None
    if user is None:
        user = User(
            phone_number=payload.phone_number,
            role=payload.role or UserRole.seller,
            full_name=payload.full_name,
            address_text=payload.address_text,
        )
        db.add(user)
        await db.flush()
    else:
        # An existing account keeps its role for life. We only ever fill in
        # missing profile details, never mutate the account type.
        if payload.address_text is not None and user.address_text != payload.address_text:
            user.address_text = payload.address_text
        if payload.full_name and not user.full_name:
            user.full_name = payload.full_name

    now = datetime.utcnow()

    # Reuse a still-valid code (idempotent resend) instead of minting a new one.
    if user.otp_code and user.otp_expires_at and user.otp_expires_at > now:
        issued_at = user.otp_expires_at - timedelta(seconds=settings.otp_expire_seconds)
        remaining = OTP_RESEND_COOLDOWN_SECONDS - (now - issued_at).total_seconds()
        retry_after = max(0, math.ceil(remaining)) if remaining > 0 else 0
        await db.flush()
        return user, user.otp_code, retry_after, account_exists

    otp = security.generate_otp()
    user.otp_code = otp
    user.otp_expires_at = now + timedelta(seconds=settings.otp_expire_seconds)
    await db.flush()
    return user, otp, 0, account_exists


async def verify_otp(db: AsyncSession, phone_number: str, otp_code: str) -> User:
    user = await user_service.get_by_phone(db, phone_number)
    if user is None:
        raise ValueError("User not found")

    now = datetime.utcnow()
    valid = (
        bool(user.otp_code)
        and user.otp_expires_at is not None
        and user.otp_expires_at > now
        and _safe_equal(user.otp_code, otp_code)
    )
    if not valid and settings.mock_otp and _safe_equal(settings.mock_otp_code, otp_code):
        valid = True
    if not valid:
        raise ValueError("Invalid or expired OTP")

    user.otp_code = None
    user.otp_expires_at = None
    user.is_verified = True
    await db.flush()
    return user
