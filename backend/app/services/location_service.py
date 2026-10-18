"""Area-based location fallback (hub presets + a small offline gazetteer).

Live GPS is the primary source of a user's or listing's coordinates. When a
device has no GPS fix — a denied permission, a feature phone, a dead battery —
we fall back to the area the user gave us instead of dropping them from
dispatch entirely:

* **hub** — the collector picked one of the platform's operational areas
  (``HUB_PRESETS``), which is how USSD/feature-phone onboarding works.
* **address** — we scan the free-text address for a known neighbourhood or
  landmark in the ``GAZETTEER``.

Neither source is GPS-accurate: these are approximate area centroids. Callers
therefore widen the search radius for fallback matches (see
``settings.location_fallback_radius_multiplier``) and label the resulting
location as approximate rather than exact.
"""

import re

# How a coordinate was obtained. Stored as a short string (like the app's
# other enums) so it can travel alongside a listing without a migration quirk.
PRECISION_GPS = "gps"
PRECISION_HUB = "hub"
PRECISION_ADDRESS = "address"

# Lower rank sorts first, so an exact GPS match beats an approximate one when
# both are in range.
PRECISION_RANK = {PRECISION_GPS: 0, PRECISION_HUB: 1, PRECISION_ADDRESS: 1}


def is_approximate(precision: str | None) -> bool:
    """True unless the coordinate came from a real GPS fix."""
    return precision not in (None, PRECISION_GPS)


# Operational areas used across the platform (USSD menu, dispatch bubbles).
# Kept here as the single source of truth; ``ussd_handler`` imports them.
HUB_PRESETS: dict[str, tuple[str, float, float]] = {
    "1": ("Samaru", 11.1547, 7.6478),
    "2": ("Sabon Gari", 11.1313, 7.6299),
    "3": ("Kongo", 11.1113, 7.7227),
    "4": ("Bomo", 11.1426, 7.6983),
    "5": ("Hanwa", 11.0962, 7.7415),
    "6": ("Dutsen Abba", 11.0952, 7.6875),
}

_HUB_COORDS: dict[str, tuple[float, float]] = {
    name.strip().lower(): (lat, lng) for name, lat, lng in HUB_PRESETS.values()
}


# Approximate neighbourhood / landmark centroids around Zaria. These are a
# deliberate offline fallback — good enough to decide "same part of town", not
# a substitute for GPS. Keys are matched case-insensitively as whole words in
# the normalised address, longest key first.
GAZETTEER: dict[str, tuple[float, float]] = {
    # Hub areas (mirrors HUB_PRESETS so hub names also match inside an address).
    "samaru": (11.1547, 7.6478),
    "sabon gari": (11.1313, 7.6299),
    "kongo": (11.1113, 7.7227),
    "bomo": (11.1426, 7.6983),
    "hanwa": (11.0962, 7.7415),
    "dutsen abba": (11.0952, 7.6875),
    # Wider Zaria areas and landmarks (approximate centroids).
    "zaria": (11.1135, 7.7188),
    "zaria city": (11.0855, 7.7199),
    "tudun wada": (11.0846, 7.7153),
    "wusasa": (11.0754, 7.6792),
    "kwarbai": (11.0596, 7.7205),
    "chikaji": (11.1135, 7.7188),
    "gyallesu": (11.0800, 7.7000),
    "muchia": (11.0900, 7.7100),
    "basawa": (11.0830, 7.7000),
    "danmagaji": (11.1000, 7.7300),
    "kofar gayan": (11.0830, 7.7250),
    "kofar doka": (11.0900, 7.7200),
    "kofar kibo": (11.0850, 7.7200),
    "kofar kuyambana": (11.0850, 7.7200),
}

# Longest keys first so "zaria city" wins over "zaria", and "sabon gari" isn't
# shadowed by a shorter token.
_GAZETTEER_KEYS = sorted(GAZETTEER, key=len, reverse=True)
_GAZETTEER_PATTERNS = {
    key: re.compile(r"(?<![a-z0-9])" + re.escape(key) + r"(?![a-z0-9])")
    for key in _GAZETTEER_KEYS
}


def match_hub(hub: str | None) -> tuple[float, float] | None:
    """Resolve a hub/area name to its preset coordinates, if it is one of ours.

    The column default ("Zaria") is deliberately *not* a hub preset, so a user
    who never chose an area cannot be silently placed at a city-wide centroid.
    """
    if not hub:
        return None
    return _HUB_COORDS.get(hub.strip().lower())


def match_address(address_text: str | None) -> tuple[str, float, float] | None:
    """Find the best-known place mentioned in a free-text address.

    Returns ``(matched_key, lat, lng)`` for the longest gazetteer entry that
    appears as a whole word, or ``None`` when nothing matches.
    """
    if not address_text:
        return None
    normalized = _normalize(address_text)
    if not normalized:
        return None
    for key in _GAZETTEER_KEYS:
        if _GAZETTEER_PATTERNS[key].search(normalized):
            lat, lng = GAZETTEER[key]
            return key, lat, lng
    return None


def resolve_fallback(
    hub: str | None = None, address_text: str | None = None
) -> tuple[float, float, str] | None:
    """Best approximate coordinate for an area, or ``None`` if unknown.

    Hubs win over free-text addresses because they are structured input. The
    returned precision (``hub`` or ``address``) tells the caller how much to
    trust the point.
    """
    hub_coords = match_hub(hub)
    if hub_coords is not None:
        return hub_coords[0], hub_coords[1], PRECISION_HUB

    matched = match_address(address_text)
    if matched is not None:
        _key, lat, lng = matched
        return lat, lng, PRECISION_ADDRESS

    return None


def _normalize(text: str) -> str:
    """Lowercase and collapse everything but letters/digits into single spaces."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
