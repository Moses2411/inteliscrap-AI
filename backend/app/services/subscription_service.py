from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    Listing,
    ListingStatus,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
    UserRole,
    UserSubscription,
)
from app.schemas import ListingCreate, SubscriptionPurchaseRequest, SubscriptionStatusResponse


# Subscription constants
FREEMIUM_DAILY_LIMIT = 4
FREEMIUM_MAX_WEIGHT_KG = Decimal("100")  # Max 100kg per listing for freemium
QUARTERLY_PRICE_NAIRA = Decimal("2500")  # ₦2,500 per quarter
QUARTERLY_DAYS = 90


async def get_user_subscription_status(db: AsyncSession, user: User) -> SubscriptionStatusResponse:
    """Get current subscription status for a user."""
    # Reset daily counter if new day
    today = date.today()
    if user.listings_today_date != today:
        user.listings_today = 0
        user.listings_today_date = today
        await db.flush()

    # Check if quarterly subscription is still valid
    if user.subscription_plan == SubscriptionPlan.quarterly:
        if user.subscription_expires_at and user.subscription_expires_at < datetime.utcnow():
            # Subscription expired, downgrade to freemium
            user.subscription_plan = SubscriptionPlan.freemium
            user.subscription_status = SubscriptionStatus.expired
            user.subscription_expires_at = None
            await db.flush()

    daily_limit = FREEMIUM_DAILY_LIMIT
    max_weight = FREEMIUM_MAX_WEIGHT_KG

    if user.subscription_plan == SubscriptionPlan.quarterly:
        daily_limit = -1  # Unlimited
        max_weight = None  # Unlimited

    return SubscriptionStatusResponse(
        plan=user.subscription_plan.value,
        status=user.subscription_status.value,
        expires_at=user.subscription_expires_at,
        listings_today=user.listings_today,
        daily_limit=daily_limit,
        max_weight_kg=float(max_weight) if max_weight else None,
    )


async def can_create_listing(
    db: AsyncSession,
    user: User,
    estimated_weight_kg: float | None = None,
) -> tuple[bool, str | None]:
    """
    Check if user can create a listing based on subscription.
    Returns (allowed, error_message).
    """
    # Only household and collector can create listings
    if user.role not in (UserRole.household, UserRole.collector):
        return False, "Only households and collectors can create listings"

    # Reset daily counter if new day
    today = date.today()
    if user.listings_today_date != today:
        user.listings_today = 0
        user.listings_today_date = today
        await db.flush()

    # Check quarterly subscription validity
    if user.subscription_plan == SubscriptionPlan.quarterly:
        if user.subscription_expires_at and user.subscription_expires_at < datetime.utcnow():
            user.subscription_plan = SubscriptionPlan.freemium
            user.subscription_status = SubscriptionStatus.expired
            user.subscription_expires_at = None
            await db.flush()

    # Freemium limits
    if user.subscription_plan == SubscriptionPlan.freemium:
        if user.listings_today >= FREEMIUM_DAILY_LIMIT:
            return False, f"Daily listing limit reached ({FREEMIUM_DAILY_LIMIT}/day). Upgrade to quarterly plan for unlimited listings."

        if estimated_weight_kg and Decimal(str(estimated_weight_kg)) > FREEMIUM_MAX_WEIGHT_KG:
            return False, f"Listing weight exceeds freemium limit ({FREEMIUM_MAX_WEIGHT_KG}kg). Upgrade to quarterly plan for unlimited quantity."

    return True, None


async def increment_listing_count(db: AsyncSession, user: User) -> None:
    """Increment user's daily listing count."""
    today = date.today()
    if user.listings_today_date != today:
        user.listings_today = 1
        user.listings_today_date = today
    else:
        user.listings_today += 1
    await db.flush()


async def purchase_subscription(
    db: AsyncSession,
    user: User,
    request: SubscriptionPurchaseRequest,
) -> UserSubscription:
    """Purchase a quarterly subscription for the user."""
    if request.plan != "quarterly":
        raise ValueError("Only quarterly plan is available")

    # Create subscription record
    expires_at = datetime.utcnow() + timedelta(days=QUARTERLY_DAYS)
    subscription = UserSubscription(
        user_id=user.id,
        plan=SubscriptionPlan.quarterly,
        amount_naira=QUARTERLY_PRICE_NAIRA,
        cycle="quarterly",
        expires_at=expires_at,
        status=SubscriptionStatus.active,
        payment_method=request.payment_method,
        payment_reference=request.payment_reference,
    )
    db.add(subscription)

    # Update user
    user.subscription_plan = SubscriptionPlan.quarterly
    user.subscription_status = SubscriptionStatus.active
    user.subscription_expires_at = expires_at

    await db.flush()
    return subscription


async def get_subscription_plans() -> list[dict]:
    """Get available subscription plans."""
    return [
        {
            "plan": "freemium",
            "name": "Free",
            "price_naira": 0,
            "cycle": "daily",
            "features": [
                "Up to 4 listings per day",
                "Maximum 100kg per listing",
                "Basic price visibility",
                "Standard support",
            ],
            "limits": {
                "daily_listings": FREEMIUM_DAILY_LIMIT,
                "max_weight_kg": float(FREEMIUM_MAX_WEIGHT_KG),
            },
        },
        {
            "plan": "quarterly",
            "name": "Quarterly Pro",
            "price_naira": int(QUARTERLY_PRICE_NAIRA),
            "cycle": "quarterly",
            "features": [
                "Unlimited listings",
                "Unlimited quantity per listing",
                "Priority in collector matching",
                "Advanced analytics",
                "Priority support",
            ],
            "limits": {
                "daily_listings": -1,  # Unlimited
                "max_weight_kg": None,  # Unlimited
            },
        },
    ]