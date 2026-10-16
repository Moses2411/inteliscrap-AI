"""Subscription payments: MTN MoMo checkout, status polling and webhook.

Flow
----
1. ``POST /momo/checkout`` — the app prices the plan server-side and asks MoMo
   to push a prompt to the payer's phone. Returns our ``reference_id``.
2. MoMo calls back ``POST /momo/callback/{reference_id}`` (when a public
   callback base URL is configured) *or* the app polls
   ``GET /{reference_id}`` / ``POST /{reference_id}/refresh``.
3. On success the payment is applied to the subscription exactly once.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models import PaymentStatus, User, UserRole
from app.schemas import (
    MomoCheckoutRequest,
    MomoCheckoutResponse,
    MomoConfigResponse,
    PaymentStatusResponse,
)
from app.services import momo_service, payment_service

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


@router.get("/momo/config", response_model=MomoConfigResponse)
async def momo_config():
    """Non-secret MoMo status so the UI can enable/disable the pay button."""
    return MomoConfigResponse(
        enabled=momo_service.enabled(),
        environment=settings.momo_target_environment,
        currency=settings.momo_currency,
        callback_configured=bool(settings.momo_callback_base_url),
    )


@router.post(
    "/momo/checkout",
    response_model=MomoCheckoutResponse,
    status_code=status.HTTP_201_CREATED,
)
async def momo_checkout(
    body: MomoCheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a payment: creates a pending attempt and prompts the payer."""
    try:
        payment = await payment_service.create_checkout(
            db,
            user,
            purpose=body.purpose,
            plan=body.plan,
            phone_number=body.phone_number,
        )
    except momo_service.MomoError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    await db.commit()
    return MomoCheckoutResponse(
        reference_id=payment.reference_id,
        status=payment.status.value,
        purpose=payment.purpose.value,
        plan=payment.plan,
        amount=float(payment.amount),
        currency=payment.currency,
        payer_msisdn=payment.payer_msisdn,
        message="Approve the payment prompt on your phone.",
    )


@router.post("/momo/callback/{reference_id}", status_code=status.HTTP_200_OK)
async def momo_callback(
    reference_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Webhook MoMo posts the final status to.

    Unauthenticated by design — it is called by MTN, not a logged-in user. The
    ``reference_id`` in the path is unguessable and we only ever act on a
    pending payment, so a stray/replayed call cannot change a settled one.
    """
    payment = await payment_service.get_payment_by_reference(db, reference_id)
    if payment is not None and payment.status == PaymentStatus.pending:
        payment_service._apply_provider_status(payment, payload)
        if payment.status == PaymentStatus.successful:
            await payment_service.apply_payment(db, payment)
        await db.commit()
    return {"received": True}


@router.post("/momo/provision")
async def provision_momo_api_user(
    payload: dict | None = None,
    user: User = Depends(require_role(UserRole.admin)),
):
    """One-time sandbox helper: create an API user + key from the product key.

    Disabled outside debug mode so it can never run against production.
    """
    if not settings.debug:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Provisioning is only available in debug/test mode.",
        )
    body = payload or {}
    host = (
        body.get("callback_host")
        or settings.momo_callback_base_url
        or "inteliscrap.example.com"
    )
    try:
        api_user, api_key = await momo_service.provision_api_user(callback_host=host)
    except momo_service.MomoError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return {
        "api_user": api_user,
        "api_key": api_key,
        "note": "Set MOMO_API_USER and MOMO_API_KEY (and MOMO_ENABLED=true), then restart.",
    }


@router.get("", response_model=list[PaymentStatusResponse])
@router.get("/", response_model=list[PaymentStatusResponse], include_in_schema=False)
async def list_payments(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payments = await payment_service.list_payments_for_user(db, user)
    return [await payment_service.build_status_response(db, p, user) for p in payments]


@router.get("/{reference_id}", response_model=PaymentStatusResponse)
async def get_payment(
    reference_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payment = await payment_service.get_payment_for_user(db, reference_id, user)
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    return await payment_service.build_status_response(db, payment, user)


@router.post("/{reference_id}/refresh", response_model=PaymentStatusResponse)
async def refresh_payment(
    reference_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Actively poll MoMo — used when a callback URL is not reachable."""
    payment = await payment_service.get_payment_for_user(db, reference_id, user)
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    await payment_service.refresh_payment(db, payment)
    await db.commit()
    return await payment_service.build_status_response(db, payment, user)
