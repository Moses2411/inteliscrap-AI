from datetime import datetime, timedelta
from urllib.parse import quote

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    Listing,
    Pickup,
    PickupStatus,
    Transaction,
    TransactionStatus,
    User,
    UserRole,
)
from app.services import pickup_service

_SESSION_TTL_SECONDS = 300

_sessions: dict[str, dict] = {}


def _fmt_num(value) -> str:
    if value is None:
        return "0"
    try:
        return f"{float(value):g}"
    except (TypeError, ValueError):
        return str(value)


def _get_state(session_id: str) -> dict:
    state = _sessions.get(session_id)
    if state is None:
        return {}
    if datetime.utcnow() - state["updated_at"] > timedelta(seconds=_SESSION_TTL_SECONDS):
        _sessions.pop(session_id, None)
        return {}
    return state


def _set_state(session_id: str, state: dict) -> None:
    state["updated_at"] = datetime.utcnow()
    _sessions[session_id] = state


def _say(text: str) -> dict:
    if settings.voice_public_base_url:
        url = f"{settings.voice_public_base_url.rstrip('/')}/api/v1/voice/audio?text={quote(text)}&lang=ha"
        return {"Say": {"play": url, "playBeep": True}}
    return {"Say": {"text": text, "voice": "female", "playBeep": True}}


def _get_digits(num_digits: int = 1, timeout: int = 10) -> dict:
    return {"GetDigits": {"numDigits": num_digits, "timeout": timeout, "finishOnKey": "#"}}


async def _find_collector(db: AsyncSession, phone_number: str) -> User | None:
    result = await db.execute(
        select(User).where(User.phone_number == phone_number, User.role == UserRole.collector)
    )
    return result.scalar_one_or_none()


async def handle_voice(db: AsyncSession, params: dict) -> dict:
    if str(params.get("isActive", "1")) != "1":
        return {"Reject": {}}

    session_id = params.get("sessionId", "")
    phone = params.get("callerNumber", "")
    dtmf = (params.get("dtmfDigits") or "").strip()

    collector = await _find_collector(db, phone)
    if collector is None:
        return {**_say("Wannan lambar ba ta da rijista."), "Reject": {}}

    state = _get_state(session_id)

    if not state:
        _set_state(session_id, {"step": "menu"})
        return {
            **_say("Barka da zuwa InteliScrap. Danna 1 domin sabbin kaya, 2 domin ayyukanka, 3 domin lissafi."),
            **_get_digits(),
        }

    step = state.get("step")

    if step == "menu":
        if dtmf == "1":
            offers = await pickup_service.get_pending_offers(db, collector)
            if not offers:
                return {**_say("Babu sabbin kaya a yanzu."), "Reject": {}}
            lines = []
            for i, (_, listing, material) in enumerate(offers[:9], start=1):
                lines.append(f"{i}, {material.name}, {_fmt_num(listing.estimated_weight_kg)} kg.")
            _set_state(session_id, {"step": "offers", "offers": [(p.id, l.id) for p, l, _ in offers]})
            return {**_say(" ".join(lines) + " Danna lambar kaya domin karba."), **_get_digits()}
        if dtmf == "2":
            result = await db.execute(
                select(func.count())
                .select_from(Pickup)
                .where(
                    Pickup.collector_id == collector.id,
                    Pickup.status.in_(
                        [PickupStatus.accepted, PickupStatus.en_route, PickupStatus.arrived]
                    ),
                )
            )
            count = result.scalar_one()
            return {**_say(f"Kana da ayyuka {count} a halin yanzu."), "Reject": {}}
        if dtmf == "3":
            result = await db.execute(
                select(func.coalesce(func.sum(Transaction.collector_earnings_naira), 0)).where(
                    Transaction.collector_id == collector.id,
                    Transaction.status == TransactionStatus.settled,
                )
            )
            total = result.scalar_one()
            return {**_say(f"Jimillar samunka, naira {total}."), "Reject": {}}
        return {**_say("Zabin bai inganta ba."), "Reject": {}}

    if step == "offers":
        try:
            index = int(dtm)
        except (TypeError, ValueError):
            return {**_say("Zabin bai inganta ba."), "Reject": {}}
        offers = state.get("offers", [])
        if index < 1 or index > len(offers):
            return {**_say("Zabin bai inganta ba."), "Reject": {}}
        pickup_id, listing_id = offers[index - 1]
        pickup = await db.get(Pickup, pickup_id)
        listing = await db.get(Listing, listing_id)
        await pickup_service.accept_pickup(db, pickup, listing)
        await pickup_service.enqueue_location_sms(db, collector, pickup, listing)
        return {**_say("An karba. An aiko maka SMS da cikakken adireshin. Na gode!"), "Reject": {}}

    return {"Reject": {}}
