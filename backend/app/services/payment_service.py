"""Subscription checkout orchestration on top of the MoMo client.

This module owns the lifecycle of a :class:`PaymentTransaction`:

1. :func:`create_checkout` prices the plan server-side, records a pending
   payment and asks MoMo to push a prompt to the payer.
2. :func:`refresh_payment` polls MoMo and folds the result back in.
3. :func:`apply_payment` turns a successful payment into a subscription exactly
   once (guarded by ``applied``), so a callback and a poll can race safely.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    PaymentMethod,
    PaymentPurpose,
    PaymentStatus,
    PaymentTransaction,
    RecyclingHub,
    SubscriptionPlan,
    User,
    UserRole,
)
from app.schemas import (
    PaymentStatusResponse,
    SubscriptionPurchaseRequest,
    SubscriptionStatusResponse,
)
from app.services import hub_service, momo_service, subscription_service

# Server-side prices — never trust an amount from the client.
HUB_PRO_PRICE_NAIRA = Decimal("25000")

_HUB_PLANS = {"pro"}


def _callback_url(reference_id: str) -> str | None:
    base = (settings.momo_callback_base_url or "").rstrip("/")
    if not base:
        return None
    return f"{base}/api/v1/payments/momo/callback/{reference_id}"


async def _resolve_plan(
    db: AsyncSession, user: User, purpose: PaymentPurpose, plan: str
) -> tuple[str, Decimal, RecyclingHub | None]:
    """Return ``(canonical_plan, amount, hub)`` for a checkout request."""
    if purpose == PaymentPurpose.user_subscription:
        requested = plan.lower()
        if requested == SubscriptionPlan.quarterly.value:
            return "quarterly", subscription_service.QUARTERLY_PRICE_NAIRA, None
        try:
            sub_plan = SubscriptionPlan(requested)
        except ValueError:
            raise momo_service.MomoError("Unknown subscription plan.", status_code=400)
        if sub_plan not in subscription_service.PREMIUM_PLANS:
            raise momo_service.MomoError("Unknown subscription plan.", status_code=400)
        expected = subscription_service.PREMIUM_PLAN_BY_ROLE.get(user.role)
        if user.role != UserRole.admin and expected is not None and sub_plan != expected:
            raise momo_service.MomoError(
                "This plan is not available for your account type.", status_code=400
            )
        return sub_plan.value, subscription_service.PREMIUM_PRICE_BY_PLAN[sub_plan], None

    if purpose == PaymentPurpose.hub_subscription:
        if plan.lower() not in _HUB_PLANS:
            raise momo_service.MomoError("Unknown hub plan.", status_code=400)
        hub = await hub_service.get_hub_by_owner(db, user)
        if hub is None:
            raise momo_service.MomoError(
                "Register a recycling hub first.", status_code=404
            )
        return "Pro", HUB_PRO_PRICE_NAIRA, hub

    raise momo_service.MomoError("Unknown payment purpose.", status_code=400)


async def create_checkout(
    db: AsyncSession,
    user: User,
    *,
    purpose: PaymentPurpose,
    plan: str,
    phone_number: str,
) -> PaymentTransaction:
    if not momo_service.enabled():
        raise momo_service.MomoError(
            "MTN MoMo is not configured. Set the MoMo credentials to enable payments.",
            status_code=503,
        )

    canonical_plan, amount, hub = await _resolve_plan(db, user, purpose, plan)
    msisdn = momo_service.normalize_msisdn(phone_number)
    reference_id = str(uuid.uuid4())

    payment = PaymentTransaction(
        user_id=user.id,
        hub_id=hub.id if hub else None,
        purpose=purpose,
        plan=canonical_plan,
        amount=amount,
        currency=settings.momo_currency,
        reference_id=reference_id,
        external_id=reference_id,
        payer_msisdn=msisdn,
        status=PaymentStatus.pending,
    )
    db.add(payment)
    await db.flush()

    try:
        await momo_service.request_to_pay(
            reference_id=reference_id,
            amount=amount,
            currency=settings.momo_currency,
            msisdn=msisdn,
            payer_message=f"InteliScrap {canonical_plan} subscription",
            payee_note="InteliScrap subscription",
            callback_url=_callback_url(reference_id),
        )
    except momo_service.MomoError as exc:
        payment.status = PaymentStatus.failed
        payment.provider_status = "ERROR"
        payment.failure_reason = exc.message[:255]
        payment.completed_at = datetime.utcnow()
        await db.flush()
        raise

    return payment


def _apply_provider_status(payment: PaymentTransaction, payload: dict) -> None:
    """Fold a raw MoMo status payload into the payment row (no commit)."""
    if not isinstance(payload, dict):
        return
    raw = str(payload.get("status") or "").upper()
    if raw:
        payment.provider_status = raw
    mapped = momo_service.map_status(raw)
    if mapped == "successful":
        payment.failure_reason = None
    elif mapped == "failed":
        reason = payload.get("reason") or payload.get("message")
        if reason:
            payment.failure_reason = str(reason)[:255]

    financial_id = payload.get("financialTransactionId")
    if financial_id:
        payment.provider_financial_tx_id = str(financial_id)[:120]
    payment.raw_payload = payload

    payment.status = PaymentStatus(mapped)
    if mapped != "pending" and payment.completed_at is None:
        payment.completed_at = datetime.utcnow()


async def apply_payment(db: AsyncSession, payment: PaymentTransaction) -> None:
    """Activate the subscription for a successful payment, exactly once."""
    if payment.applied or payment.status != PaymentStatus.successful:
        return

    user = await db.get(User, payment.user_id)
    if user is None:
        payment.applied = True
        payment.failure_reason = "Payer account no longer exists."
        await db.flush()
        return

    if payment.purpose == PaymentPurpose.user_subscription:
        await subscription_service.purchase_subscription(
            db,
            user,
            SubscriptionPurchaseRequest(
                plan=payment.plan,
                payment_method=PaymentMethod.mobile_money,
                payment_reference=payment.reference_id,
            ),
        )
    elif payment.purpose == PaymentPurpose.hub_subscription:
        hub = await db.get(RecyclingHub, payment.hub_id) if payment.hub_id else None
        if hub is not None:
            await hub_service.create_subscription(
                db,
                hub,
                plan_name=payment.plan,
                amount_naira=float(payment.amount),
                payment_method=PaymentMethod.mobile_money.value,
                payment_reference=payment.reference_id,
            )

    payment.applied = True
    await db.flush()


async def refresh_payment(
    db: AsyncSession, payment: PaymentTransaction
) -> PaymentTransaction:
    """Poll MoMo for the latest status and activate on success.

    Transient upstream failures leave the payment ``pending`` so a later poll
    (or the callback) can still settle it.
    """
    if payment.status != PaymentStatus.pending or not momo_service.enabled():
        return payment

    try:
        payload = await momo_service.get_payment_status(payment.reference_id)
    except momo_service.MomoError:
        return payment

    _apply_provider_status(payment, payload)
    if payment.status == PaymentStatus.successful:
        await apply_payment(db, payment)
    await db.flush()
    return payment


async def get_payment_for_user(
    db: AsyncSession, reference_id: str, user: User
) -> PaymentTransaction | None:
    result = await db.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.reference_id == reference_id,
            PaymentTransaction.user_id == user.id,
        )
    )
    return result.scalar_one_or_none()


async def get_payment_by_reference(
    db: AsyncSession, reference_id: str
) -> PaymentTransaction | None:
    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.reference_id == reference_id)
    )
    return result.scalar_one_or_none()


async def list_payments_for_user(
    db: AsyncSession, user: User, limit: int = 20
) -> list[PaymentTransaction]:
    result = await db.execute(
        select(PaymentTransaction)
        .where(PaymentTransaction.user_id == user.id)
        .order_by(PaymentTransaction.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def build_status_response(
    db: AsyncSession, payment: PaymentTransaction, user: User
) -> PaymentStatusResponse:
    subscription: SubscriptionStatusResponse | None = None
    if payment.purpose == PaymentPurpose.user_subscription and payment.applied:
        subscription = await subscription_service.get_user_subscription_status(db, user)

    return PaymentStatusResponse(
        reference_id=payment.reference_id,
        status=payment.status.value,
        purpose=payment.purpose.value,
        plan=payment.plan,
        amount=float(payment.amount),
        currency=payment.currency,
        payer_msisdn=payment.payer_msisdn,
        provider_status=payment.provider_status,
        provider_financial_tx_id=payment.provider_financial_tx_id,
        failure_reason=payment.failure_reason,
        applied=payment.applied,
        completed_at=payment.completed_at,
        subscription=subscription,
    )
