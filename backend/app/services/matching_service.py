import math

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Listing, ListingStatus, Pickup, PickupStatus, User, UserRole

EARTH_RADIUS_M = 6371000.0

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
    if db.bind.dialect.name == "postgresql":
        return await _find_nearby_postgis(db, latitude, longitude, radius_m, limit)
    return await _find_nearby_haversine(db, latitude, longitude, radius_m, limit)


async def dispatch_listing(
    db: AsyncSession, listing: Listing, radius_m: int = 5000, limit: int = 5
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

    await db.flush()
    return offers
