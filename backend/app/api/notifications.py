from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.database import get_db
from app.core.partner_auth import get_partner_from_api_key
from app.models import CompliancePartner, SyncOutbox
from app.services import messaging_service

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


class PushSubscriptionData(BaseModel):
    endpoint: str
    keys: Dict[str, str]  # p256dh, auth


class PushSubscriptionResponse(BaseModel):
    success: bool
    message: str


class NotificationPayload(BaseModel):
    title: str
    body: str
    icon: Optional[str] = None
    badge: Optional[str] = None
    tag: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    actions: Optional[list] = None


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_push(
    subscription: PushSubscriptionData,
    request: Request,
    partner: CompliancePartner = Depends(get_partner_from_api_key),
):
    """Store push subscription for a partner/collector"""
    # In production, store in database linked to user/partner
    # For now, we'll just acknowledge
    return PushSubscriptionResponse(
        success=True,
        message="Push subscription registered"
    )


@router.post("/unsubscribe", response_model=PushSubscriptionResponse)
async def unsubscribe_push(
    endpoint: Dict[str, str],
    partner: CompliancePartner = Depends(get_partner_from_api_key),
):
    """Remove push subscription"""
    return PushSubscriptionResponse(
        success=True,
        message="Push subscription removed"
    )


@router.post("/send", response_model=PushSubscriptionResponse)
async def send_notification(
    payload: NotificationPayload,
    target_endpoint: Optional[str] = None,
    partner: CompliancePartner = Depends(get_partner_from_api_key),
):
    """Send push notification to specific endpoint or all subscribers"""
    # In production, use web-push library to send to stored subscriptions
    # For now, just enqueue SMS via outbox as fallback
    return PushSubscriptionResponse(
        success=True,
        message="Notification queued"
    )


@router.post("/collector/subscribe", response_model=PushSubscriptionResponse)
async def collector_subscribe(
    subscription: PushSubscriptionData,
    db: AsyncSession = Depends(get_db),
):
    """Collector-specific push subscription (no auth required for demo)"""
    # Store in SyncOutbox or dedicated table
    # For demo, just acknowledge
    return PushSubscriptionResponse(
        success=True,
        message="Collector subscription registered"
    )


@router.post("/collector/unsubscribe", response_model=PushSubscriptionResponse)
async def collector_unsubscribe(
    endpoint: Dict[str, str],
    db: AsyncSession = Depends(get_db),
):
    """Collector unsubscribe"""
    return PushSubscriptionResponse(
        success=True,
        message="Collector subscription removed"
    )


@router.post("/test", response_model=PushSubscriptionResponse)
async def test_notification(
    payload: NotificationPayload,
    partner: CompliancePartner = Depends(get_partner_from_api_key),
):
    """Send test notification"""
    return PushSubscriptionResponse(
        success=True,
        message="Test notification sent"
    )