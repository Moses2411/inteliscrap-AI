import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

import jwt

from app.config import settings


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_pin() -> str:
    """A 6-digit numeric handover code (collector shows it, seller enters it)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_pin(pin: str) -> str:
    """Keyed hash so the plaintext PIN is never stored at rest."""
    return hmac.new(
        settings.jwt_secret_key.encode(), pin.encode(), hashlib.sha256
    ).hexdigest()


def verify_pin(pin: str, pin_hash: str | None) -> bool:
    if not pin_hash:
        return False
    return hmac.compare_digest(hash_pin(pin), pin_hash)


def create_access_token(user_id: str, role: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
