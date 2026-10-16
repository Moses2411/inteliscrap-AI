"""MTN MoMo Collections API client (Request-to-Pay).

Only the slice of the MoMo Open API needed to collect subscription payments is
implemented:

* one-time sandbox provisioning of an API user + API key from the Collections
  subscription key;
* OAuth access tokens, cached until shortly before they expire;
* ``requesttopay`` to push a payment prompt to the payer's phone;
* polling a request's status.

Everything is driven by :mod:`app.config`, so the same code runs against the
sandbox (EUR) and a country production proxy (local currency). The only module
state is the short-lived token cache.

Reference: https://momodeveloper.mtn.com (Collections product).
"""

from __future__ import annotations

import base64
import re
import time
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx

from app.config import settings

# MoMo statuses we care about, mapped to our own coarse payment status.
_SUCCESS = {"SUCCESSFUL"}
_FAILED = {"FAILED", "REJECTED", "TIMEOUT", "CANCELLED"}


class MomoError(Exception):
    """A MoMo API call failed.

    ``status_code`` mirrors the upstream HTTP status (502 for connectivity
    problems) so API handlers can pass it straight through.
    """

    def __init__(self, message: str, status_code: int = 502, payload: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload


@dataclass
class _CachedToken:
    value: str
    expires_at: float


_token_cache: _CachedToken | None = None


def has_subscription_key() -> bool:
    return bool(settings.momo_subscription_key)


def enabled() -> bool:
    """True when a full payment flow can run (product key + API user + key)."""
    return bool(
        settings.momo_enabled
        and settings.momo_subscription_key
        and settings.momo_api_user
        and settings.momo_api_key
    )


def reset_token_cache() -> None:
    """Drop the cached token (used by tests and after credential changes)."""
    global _token_cache
    _token_cache = None


def normalize_msisdn(phone: str, country_code: str | None = None) -> str:
    """Turn a loosely formatted number into the MSISDN MoMo expects.

    ``0803 123 4567`` -> ``2348031234567`` for the default Nigerian country
    code. Already-international numbers are left alone.
    """
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        raise MomoError("A valid mobile money number is required.", status_code=422)

    cc = (country_code or settings.momo_msisdn_country_code or "").lstrip("+")
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = f"{cc}{digits[1:]}"
    elif cc and not digits.startswith(cc) and len(digits) <= 10:
        digits = f"{cc}{digits}"
    return digits


def _format_amount(amount: Decimal | float) -> str:
    """MoMo expects the amount as a string; drop needless decimals."""
    value = Decimal(str(amount)).normalize()
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def map_status(raw: str | None) -> str:
    """Map a MoMo status string to our ``PaymentStatus`` value."""
    status = (raw or "").upper()
    if status in _SUCCESS:
        return "successful"
    if status in _FAILED:
        return "failed"
    return "pending"


def _base_url() -> str:
    return settings.momo_base_url.rstrip("/")


def _safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:  # noqa: BLE001 - upstream may return HTML on gateway errors
        return None


def _extract_error(response: httpx.Response) -> str:
    payload = _safe_json(response)
    if isinstance(payload, dict):
        for key in ("message", "detail", "error", "code"):
            value = payload.get(key)
            if value:
                return str(value)
    text = (response.text or "").strip()
    return text[:200] or f"MTN MoMo request failed ({response.status_code})"


async def _request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json: Any = None,
    expected: tuple[int, ...] = (200, 201, 202),
) -> Any:
    try:
        async with httpx.AsyncClient(timeout=settings.momo_http_timeout_s) as client:
            response = await client.request(method, url, headers=headers, json=json)
    except httpx.HTTPError as exc:  # network/timeout/DNS
        raise MomoError(f"Could not reach MTN MoMo: {exc}", status_code=502) from exc

    if response.status_code not in expected:
        raise MomoError(
            _extract_error(response),
            status_code=response.status_code,
            payload=_safe_json(response),
        )
    # 202 Accepted (request-to-pay) and empty 200/201s carry no body.
    if response.status_code == 202 or not response.content:
        return {}
    return _safe_json(response)


async def get_access_token(force: bool = False) -> str:
    """Return a cached Collections access token, refreshing when needed."""
    global _token_cache
    if not enabled():
        raise MomoError("MTN MoMo is not configured.", status_code=503)

    now = time.time()
    if not force and _token_cache and _token_cache.expires_at > now:
        return _token_cache.value

    credentials = base64.b64encode(
        f"{settings.momo_api_user}:{settings.momo_api_key}".encode()
    ).decode()
    data = await _request(
        "POST",
        f"{_base_url()}/collection/token/",
        headers={
            "Authorization": f"Basic {credentials}",
            "Ocp-Apim-Subscription-Key": settings.momo_subscription_key,
        },
        expected=(200,),
    )
    token = (data or {}).get("access_token")
    if not token:
        raise MomoError("MoMo did not return an access token.", status_code=502, payload=data)

    expires_in = int((data or {}).get("expires_in") or 3600)
    _token_cache = _CachedToken(
        value=token,
        expires_at=now + max(expires_in - settings.momo_token_skew_s, 30),
    )
    return token


def _collection_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "X-Target-Environment": settings.momo_target_environment,
        "Ocp-Apim-Subscription-Key": settings.momo_subscription_key,
        "Content-Type": "application/json",
    }


async def request_to_pay(
    *,
    reference_id: str,
    amount: Decimal | float,
    currency: str,
    msisdn: str,
    payer_message: str,
    payee_note: str,
    callback_url: str | None = None,
) -> None:
    """Push a payment prompt to the payer's phone (expects HTTP 202)."""
    token = await get_access_token()
    headers = _collection_headers(token)
    headers["X-Reference-Id"] = reference_id
    if callback_url:
        headers["X-Callback-Url"] = callback_url

    body = {
        "amount": _format_amount(amount),
        "currency": currency,
        "externalId": reference_id,
        "payer": {"partyIdType": "MSISDN", "partyId": msisdn},
        "payerMessage": payer_message[:60],
        "payeeNote": payee_note[:60],
    }
    await _request(
        "POST",
        f"{_base_url()}/collection/v1_0/requesttopay",
        headers=headers,
        json=body,
        expected=(202,),
    )


async def get_payment_status(reference_id: str) -> dict[str, Any]:
    """Fetch the current status of a previously submitted request-to-pay."""
    token = await get_access_token()
    data = await _request(
        "GET",
        f"{_base_url()}/collection/v1_0/requesttopay/{reference_id}",
        headers=_collection_headers(token),
        expected=(200,),
    )
    return data or {}


async def provision_api_user(
    *, callback_host: str = "", reference_id: str | None = None
) -> tuple[str, str]:
    """Create a sandbox API user + API key from the subscription key.

    Returns ``(api_user, api_key)``. Intended to be run once in the sandbox; in
    production MTN issues these and the app only needs to read them from env.
    """
    if not has_subscription_key():
        raise MomoError(
            "Set MOMO_SUBSCRIPTION_KEY before provisioning.", status_code=503
        )

    api_user = reference_id or str(uuid.uuid4())
    base = _base_url()
    key_header = {"Ocp-Apim-Subscription-Key": settings.momo_subscription_key}

    await _request(
        "POST",
        f"{base}/v1_0/apiuser",
        headers={**key_header, "X-Reference-Id": api_user, "Content-Type": "application/json"},
        json={"providerCallbackHost": callback_host or "inteliscrap.example.com"},
        expected=(201,),
    )
    data = await _request(
        "POST",
        f"{base}/v1_0/apiuser/{api_user}/apikey",
        headers=key_header,
        expected=(200, 201),
    )
    api_key = (data or {}).get("apiKey")
    if not api_key:
        raise MomoError("MoMo did not return an API key.", status_code=502, payload=data)
    return api_user, api_key
