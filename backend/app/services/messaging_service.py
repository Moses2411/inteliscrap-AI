import httpx

from app.config import settings

AT_SMS_URL = "https://api.africastalking.com/version1/messaging"
AT_VOICE_URL = "https://voice.africastalking.com/call"


def _headers() -> dict:
    return {"apiKey": settings.africastalking_api_key, "Accept": "application/json"}


def is_configured() -> bool:
    """True when SMS credentials are present, i.e. a send has a chance of working."""
    return bool(settings.africastalking_api_key and settings.africastalking_username)


def _ensure_configured() -> None:
    if not is_configured():
        raise RuntimeError("Africa's Talking credentials are not configured")


async def send_sms(to: str, message: str, timeout: float | None = None) -> dict:
    _ensure_configured()
    data = {
        "username": settings.africastalking_username,
        "to": to,
        "message": message,
        "from": settings.africastalking_sender_id,
    }
    async with httpx.AsyncClient(timeout=timeout or settings.provider_timeout_s) as client:
        resp = await client.post(AT_SMS_URL, data=data, headers=_headers())
        resp.raise_for_status()
        return resp.json()


async def trigger_voice_call(to: str) -> dict:
    _ensure_configured()
    data = {
        "username": settings.africastalking_username,
        "to": to,
        "from": settings.africastalking_virtual_number,
    }
    async with httpx.AsyncClient(timeout=settings.provider_timeout_s) as client:
        resp = await client.post(AT_VOICE_URL, data=data, headers=_headers())
        resp.raise_for_status()
        return resp.json()
