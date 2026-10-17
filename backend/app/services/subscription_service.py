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


# ── Plans ─────────────────────────────────────────────────────────────
FREEMIUM_WEEKLY_LIMIT = 4
QUARTERLY_PRICE_NAIRA = Decimal("2500")  # ₦2,500 per quarter
QUARTERLY_DAYS = 90
YEARLY_DAYS = 365

# Role-specific yearly "premium" plans. Prices are server-owned so a client can
# never dictate what it pays.
SELLER_YEARLY_PRICE_NAIRA = Decimal("4900")  # sellers/collectors: unlimited listings
NGO_YEARLY_PRICE_NAIRA = Decimal("49000")  # NGOs: network-wide impact data
EPR_YEARLY_PRICE_NAIRA = Decimal("99000")  # EPR/PROs: compliance manifest data

# Which yearly plan each role buys. Roles absent here cannot self-serve premium.
PREMIUM_PLAN_BY_ROLE: dict[UserRole, SubscriptionPlan] = {
    UserRole.seller: SubscriptionPlan.seller_yearly,
    UserRole.collector: SubscriptionPlan.seller_yearly,
    UserRole.ngo: SubscriptionPlan.ngo_yearly,
    UserRole.partner: SubscriptionPlan.epr_yearly,
}

PREMIUM_PRICE_BY_PLAN: dict[SubscriptionPlan, Decimal] = {
    SubscriptionPlan.seller_yearly: SELLER_YEARLY_PRICE_NAIRA,
    SubscriptionPlan.ngo_yearly: NGO_YEARLY_PRICE_NAIRA,
    SubscriptionPlan.epr_yearly: EPR_YEARLY_PRICE_NAIRA,
}

PREMIUM_PLANS = set(PREMIUM_PLAN_BY_ROLE.values())

# Roles whose "data" (impact dashboard / EPR compliance manifest) is unlocked
# by an active premium plan.
DATA_ACCESS_ROLES = {UserRole.ngo, UserRole.partner}

_PLAN_NAMES: dict[SubscriptionPlan, str] = {
    SubscriptionPlan.freemium: "Free",
    SubscriptionPlan.quarterly: "Quarterly Pro",
    SubscriptionPlan.seller_yearly: "Seller Premium",
    SubscriptionPlan.ngo_yearly: "NGO Premium",
    SubscriptionPlan.epr_yearly: "EPR Premium",
}

_YEARLY_FEATURES: dict[SubscriptionPlan, list[str]] = {
    SubscriptionPlan.seller_yearly: [
        "Unlimited listings all year",
        "Unlimited quantity per listing",
        "Priority in collector matching",
        "Priority support",
    ],
    SubscriptionPlan.ngo_yearly: [
        "Full network impact data",
        "Tonnage, carbon & income analytics",
        "Daily and by-material breakdowns",
        "Priority support",
    ],
    SubscriptionPlan.epr_yearly: [
        "Network-wide EPR compliance manifest",
        "Auditable settled-collection export",
        "JSON export for regulators",
        "Priority support",
    ],
}


def plan_name(plan: SubscriptionPlan) -> str:
    return _PLAN_NAMES.get(plan, "Free")


def is_active_premium(user: User) -> bool:
    """True when the user's own yearly premium plan is currently active."""
    if user.subscription_plan not in PREMIUM_PLANS:
        return False
    if user.subscription_status != SubscriptionStatus.active:
        return False
    if user.subscription_expires_at is None:
        return False
    return user.subscription_expires_at >= datetime.utcnow()


def has_data_access(user: User) -> bool:
    """Admins always; EPR/NGO only while their premium plan is active."""
    if user.role == UserRole.admin:
        return True
    if user.role in DATA_ACCESS_ROLES:
        return is_active_premium(user)
    return False


def _week_start(d: date) -> date:
    """Return Monday of the week for a given date."""
    return d - timedelta(days=d.weekday())


async def _reset_or_expire(db: AsyncSession, user: User) -> None:
    """Roll the weekly listing counter and lapse any paid plan that has ended."""
    today = date.today()
    week_start = _week_start(today)
    if user.listings_week_start != week_start:
        user.listings_this_week = 0
        user.listings_week_start = week_start
        await db.flush()

    if (
        user.subscription_plan != SubscriptionPlan.freemium
        and user.subscription_expires_at is not None
        and user.subscription_expires_at < datetime.utcnow()
    ):
        user.subscription_plan = SubscriptionPlan.freemium
        user.subscription_status = SubscriptionStatus.expired
        user.subscription_expires_at = None
        await db.flush()


async def get_user_subscription_status(db: AsyncSession, user: User) -> SubscriptionStatusResponse:
    """Get current subscription status for a user."""
    await _reset_or_expire(db, user)

    unlimited = user.subscription_plan in PREMIUM_PLANS or user.subscription_plan == SubscriptionPlan.quarterly

    return SubscriptionStatusResponse(
        plan=user.subscription_plan.value,
        plan_name=plan_name(user.subscription_plan),
        status=user.subscription_status.value,
        expires_at=user.subscription_expires_at,
        listings_this_week=user.listings_this_week,
        weekly_limit=-1 if unlimited else FREEMIUM_WEEKLY_LIMIT,
        max_weight_kg=None,  # No weight limit
        data_access=has_data_access(user),
    )


async def can_create_listing(
    db: AsyncSession,
    user: User,
) -> tuple[bool, str | None]:
    """
    Check if user can create a listing based on subscription.
    Returns (allowed, error_message).
    """
    # Only seller and collector can create listings
    if user.role not in (UserRole.seller, UserRole.collector):
        return False, "Only sellers and collectors can create listings"

    await _reset_or_expire(db, user)

    # Freemium limits - weekly listing count
    if user.subscription_plan == SubscriptionPlan.freemium:
        if user.listings_this_week >= FREEMIUM_WEEKLY_LIMIT:
            # Calculate days until next Monday
            days_until_next_monday = 7 - date.today().weekday()
            return (
                False,
                f"Your free plan allows {FREEMIUM_WEEKLY_LIMIT} listings a week. "
                f"Subscribe to Seller Premium for unlimited listings, or wait "
                f"{days_until_next_monday} day(s) until your limit resets.",
            )

    return True, None


async def increment_listings_this_week(db: AsyncSession, user: User) -> None:
    today = date.today()
    week_start = _week_start(today)
    if user.listings_week_start != week_start:
        user.listings_this_week = 1
        user.listings_week_start = week_start
    else:
        user.listings_this_week = (user.listings_this_week or 0) + 1
    await db.flush()


# Backwards-compatible alias (older call sites used this name).
increment_listing_count = increment_listings_this_week
increment_listing = increment_listings_this_week


async def purchase_subscription(
    db: AsyncSession,
    user: User,
    request: SubscriptionPurchaseRequest,
) -> UserSubscription:
    """Activate a paid plan for the user. Plan + price are server-owned."""
    requested = (request.plan or "").lower()

    if requested == SubscriptionPlan.quarterly.value:
        plan = SubscriptionPlan.quarterly
        amount = QUARTERLY_PRICE_NAIRA
        days = QUARTERLY_DAYS
        cycle = "quarterly"
    else:
        try:
            plan = SubscriptionPlan(requested)
        except ValueError:
            raise ValueError("Unknown subscription plan")
        if plan not in PREMIUM_PLANS:
            raise ValueError("Unknown subscription plan")
        # A buyer may only pick the premium plan for their own role (admins may
        # activate any, e.g. when assisting an account).
        expected = PREMIUM_PLAN_BY_ROLE.get(user.role)
        if user.role != UserRole.admin and expected is not None and plan != expected:
            raise ValueError("This plan is not available for your account type")
        amount = PREMIUM_PRICE_BY_PLAN[plan]
        days = YEARLY_DAYS
        cycle = "yearly"

    expires_at = datetime.utcnow() + timedelta(days=days)
    subscription = UserSubscription(
        user_id=user.id,
        plan=plan,
        amount_naira=amount,
        cycle=cycle,
        expires_at=expires_at,
        status=SubscriptionStatus.active,
        payment_method=request.payment_method,
        payment_reference=request.payment_reference,
    )
    db.add(subscription)

    user.subscription_plan = plan
    user.subscription_status = SubscriptionStatus.active
    user.subscription_expires_at = expires_at

    await db.flush()
    return subscription


async def get_subscription_plans(role: UserRole | None = None) -> list[dict]:
    """Available plans. When ``role`` is given, only plans that role can buy."""
    plans: list[dict] = [
        {
            "plan": "freemium",
            "name": "Free",
            "price_naira": 0,
            "cycle": "weekly",
            "features": [
                "Up to 4 listings per week",
                "No weight restrictions",
                "Basic price visibility",
                "Standard support",
            ],
            "limits": {
                "weekly_listings": FREEMIUM_WEEKLY_LIMIT,
                "max_weight_kg": None,
            },
        }
    ]

    if role in (None, UserRole.seller, UserRole.collector):
        plans.append(
            {
                "plan": "quarterly",
                "name": "Quarterly Pro",
                "price_naira": int(QUARTERLY_PRICE_NAIRA),
                "cycle": "quarterly",
                "features": [
                    "Unlimited listings",
                    "Unlimited quantity per listing",
                    "Priority in collector matching",
                    "Priority support",
                ],
                "limits": {
                    "weekly_listings": -1,  # Unlimited
                    "max_weight_kg": None,  # Unlimited
                },
            }
        )

    premium_plan = PREMIUM_PLAN_BY_ROLE.get(role) if role is not None else None
    for plan, price in PREMIUM_PRICE_BY_PLAN.items():
        if role is not None and plan != premium_plan:
            continue
        plans.append(
            {
                "plan": plan.value,
                "name": _PLAN_NAMES[plan],
                "price_naira": int(price),
                "cycle": "yearly",
                "features": _YEARLY_FEATURES[plan],
                "limits": {
                    "weekly_listings": -1 if plan == SubscriptionPlan.seller_yearly else 0,
                    "max_weight_kg": None,
                },
            }
        )

    return plans
