from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import (
    SubscriptionPlanResponse,
    SubscriptionPurchaseRequest,
    SubscriptionStatusResponse,
)
from app.services import subscription_service

router = APIRouter(prefix="/api/v1/subscription", tags=["subscription"])


@router.get("/plans", response_model=list[SubscriptionPlanResponse])
async def get_plans():
    """Get available subscription plans."""
    return await subscription_service.get_subscription_plans()


@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's subscription status."""
    return await subscription_service.get_user_subscription_status(db, current_user)


@router.post("/purchase", response_model=SubscriptionStatusResponse)
async def purchase_subscription(
    request: SubscriptionPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Purchase a subscription plan."""
    if request.plan != "quarterly":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only quarterly plan is available",
        )

    await subscription_service.purchase_subscription(db, current_user, request)
    await db.commit()

    return await subscription_service.get_user_subscription_status(db, current_user)


@router.get("/check-listing", response_model=dict)
async def check_listing_eligibility(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if user can create a listing."""
    allowed, error = await subscription_service.can_create_listing(db, current_user)
    return {"allowed": allowed, "error": error}