import math

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Listing, ListingStatus, Pickup, PickupStatus, SyncOutbox, User, UserRole

EARTH_RADIUS_M = 6371000.0

try:  # pragma: no cover - optional hard dependency
    import h3
except ImportError:  # pragma: no cover
    h3 = None

_POSTGIS_QUERY = text(
    """
    SELECT u.id,
           ST_Distance(
               u.geom::geography,
               ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
           ) AS dist_m
    FROM users u
    WHERE u.role = 'collector'
      AND u.is_active
      AND u.geom IS NOT NULL
      AND ST_DWithin(
               u.geom::geography,
               ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
               :radius
           )
    ORDER BY dist_m ASC
    LIMIT :limit
    """
)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def latlng_to_h3_cell(
    latitude: float, longitude: float, resolution: int | None = None
) -> str | None:
    """Bucket a coordinate into its Uber H3 hexagon cell at the configured resolution."""
    if h3 is None:
        return None
    try:
        return h3.latlng_to_cell(latitude, longitude, resolution or settings.h3_resolution)
    except Exception:
        return None


async def _h3_disk_cells(
    latitude: float, longitude: float, radius_m: int, resolution: int | None = None
) -> set[str]:
    """Expand the listing's hexagon ring-by-ring (Uber H3 grid_disk) to cover radius_m.

    Returns the listing's own cell (ring 0) plus every neighbour cell out to `k` rings.
    Exact distance filtering still happens afterwards via haversine, so over-covering
    here is safe — this mirrors Uber's hexagonal dispatch bucketing.
    """
    if h3 is None:
        return set()

    resolution = resolution or settings.h3_resolution
    origin = latlng_to_h3_cell(latitude, longitude, resolution)
    if origin is None:
        return set()

    # Approximate the physical footprint of one cell at this resolution so we can
    # derive how many rings are needed to reach radius_m. Conservative upper bound.
    approx_ring_width_m = _approx_cell_km(origin) * 1000.0
    if approx_ring_width_m <= 0:
        approx_ring_width_m = 1000.0

    k = int(math.ceil(radius_m / approx_ring_width_m)) + 1
    k = max(1, min(k, settings.h3_search_k))

    return set(h3.grid_disk(origin, k))


def _approx_cell_km(cell: str) -> float:
    """Approximate hexagon "diameter" in kilometres using its polygon area."""
    if h3 is None:
        return 1.0
    try:
        area_km2 = h3.cell_area(cell, unit="km^2")
        # Area of a regular hexagon: A = (3*sqrt(3)/2) * s^2  => s = sqrt(2A / (3*sqrt(3)))
        side_km = math.sqrt((2.0 * area_km2) / (3.0 * math.sqrt(3.0)))
        return 2.0 * side_km
    except Exception:
        return 1.0


async def _find_nearby_h3(
    db: AsyncSession, latitude: float, longitude: float, radius_m: int, limit: int
) -> list[tuple[User, float]]:
    """Find the closest collectors to a listing using Uber H3 hexagon bucketing.

    Collectors whose stored hex cell falls inside the listing's hexagonal disk are
    candidates; they are then ranked by true haversine distance so the dispatch is
    ordered by proximity across ring boundaries.
    """
    disk = await _h3_disk_cells(latitude, longitude, radius_m)
    if not disk:
        return []

    result = await db.execute(
        select(User).where(
            User.role == UserRole.collector,
            User.is_active.is_(True),
            User.latitude.isnot(None),
            User.longitude.isnot(None),
        )
    )
    collectors = list(result.scalars().all())

    ranked: list[tuple[User, float]] = []
    for collector in collectors:
        cell = collector.h3_cell or latlng_to_h3_cell(collector.latitude, collector.longitude)
        if cell not in disk:
            continue
        dist = haversine_m(latitude, longitude, collector.latitude, collector.longitude)
        if dist <= radius_m:
            ranked.append((collector, dist))

    ranked.sort(key=lambda item: item[1])
    return ranked[:limit]


async def _collector_candidates(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).where(
            User.role == UserRole.collector,
            User.is_active.is_(True),
            User.latitude.isnot(None),
            User.longitude.isnot(None),
        )
    )
    return list(result.scalars().all())


async def _find_nearby_haversine(
    db: AsyncSession, latitude: float, longitude: float, radius_m: int, limit: int
) -> list[tuple[User, float]]:
    ranked = []
    for collector in await _collector_candidates(db):
        dist = haversine_m(latitude, longitude, collector.latitude, collector.longitude)
        if dist <= radius_m:
            ranked.append((collector, dist))
    ranked.sort(key=lambda item: item[1])
    return ranked[:limit]


async def _find_nearby_postgis(
    db: AsyncSession, latitude: float, longitude: float, radius_m: int, limit: int
) -> list[tuple[User, float]]:
    result = await db.execute(
        _POSTGIS_QUERY,
        {"lat": latitude, "lon": longitude, "radius": radius_m, "limit": limit},
    )
    rows = result.fetchall()
    if not rows:
        return []

    ids = [row[0] for row in rows]
    dist_by_id = {row[0]: float(row[1]) for row in rows}

    users_result = await db.execute(select(User).where(User.id.in_(ids)))
    users = {user.id: user for user in users_result.scalars().all()}
    return [(users[uid], dist_by_id[uid]) for uid in ids if uid in users]


async def find_nearby_collectors(
    db: AsyncSession,
    latitude: float,
    longitude: float,
    radius_m: int = 5000,
    limit: int = 5,
) -> list[tuple[User, float]]:
    if h3 is not None:
        return await _find_nearby_h3(db, latitude, longitude, radius_m, limit)
    if db.bind.dialect.name == "postgresql":
        return await _find_nearby_postgis(db, latitude, longitude, radius_m, limit)
    return await _find_nearby_haversine(db, latitude, longitude, radius_m, limit)


async def dispatch_listing(
    db: AsyncSession,
    listing: Listing,
    material_name: str | None = None,
    radius_m: int = 5000,
    limit: int = 5,
) -> list[Pickup]:
    if listing.latitude is None or listing.longitude is None:
        return []

    nearby = await find_nearby_collectors(
        db, listing.latitude, listing.longitude, radius_m, limit
    )

    offers: list[Pickup] = []
    for collector, dist in nearby:
        offer = Pickup(
            listing_id=listing.id,
            collector_id=collector.id,
            status=PickupStatus.offered,
            distance_m=dist,
        )
        db.add(offer)
        offers.append(offer)

    if offers:
        listing.status = ListingStatus.matched
        _enqueue_offer_sms(db, listing, material_name, nearby)

    await db.flush()
    return offers


def _enqueue_offer_sms(
    db: AsyncSession,
    listing: Listing,
    material_name: str | None,
    nearby: list[tuple[User, float]],
) -> None:
    """Push an SMS offer to every notified collector via the outbox worker.

    The message is short and actionable so a collector on a feature phone can
    accept by dialing the USSD code.
    """
    material = material_name or "Kaya"
    weight = f" {listing.estimated_weight_kg}kg" if listing.estimated_weight_kg else ""
    for collector, dist in nearby:
        msg = (
            f"InteliScrap: New pickup - {material}{weight}, "
            f"~{max(1, int(round(dist)))}m away. Dial *384*123# to accept."
        )
        db.add(
            SyncOutbox(
                aggregate_type="pickup",
                aggregate_id=listing.id,
                event_type="sms.new_offer",
                payload={"phone_number": collector.phone_number, "message": msg},
                status="pending",
            )
        )
