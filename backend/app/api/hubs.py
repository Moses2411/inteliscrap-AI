from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models import MaterialCategory, User, UserRole
from app.schemas import (
    HubDeliveryResponse,
    HubRecyclingRequestCreate,
    HubRecyclingRequestResponse,
    HubSubscriptionCreate,
    HubSubscriptionResponse,
    RecyclingHubCreate,
    RecyclingHubResponse,
)
from app.services import hub_service

router = APIRouter(prefix="/api/v1/hubs", tags=["hubs"])


@router.post("/register", response_model=RecyclingHubResponse)
async def register_hub(
    body: RecyclingHubCreate,
    user: User = Depends(require_role(UserRole.admin, UserRole.household, UserRole.collector)),
    db: AsyncSession = Depends(get_db),
):
    existing = await hub_service.get_hub_by_owner(db, user)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a registered recycling hub",
        )
    hub = await hub_service.register_hub(
        db, user,
        name=body.name,
        address_text=body.address_text,
        latitude=body.latitude,
        longitude=body.longitude,
        city=body.city,
        contact_phone=body.contact_phone,
    )
    return hub


@router.get("/me", response_model=RecyclingHubResponse)
async def get_my_hub(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub = await hub_service.get_hub_by_owner(db, user)
    if hub is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recycling hub registered for this account",
        )
    return hub


@router.get("/", response_model=list[RecyclingHubResponse])
async def list_hubs(db: AsyncSession = Depends(get_db)):
    return await hub_service.list_active_hubs(db)


@router.post("/requests", response_model=HubRecyclingRequestResponse)
async def create_hub_request(
    body: HubRecyclingRequestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub = await hub_service.get_hub_by_owner(db, user)
    if hub is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Register a recycling hub first",
        )
    material = await db.get(MaterialCategory, body.material_category_id)
    if material is None:
        raise HTTPException(status_code=404, detail="Material category not found")

    req_on = (
        body.requested_on.date()
        if isinstance(body.requested_on, datetime)
        else body.requested_on
    )
    req = await hub_service.create_request(
        db,
        hub,
        material_category_id=body.material_category_id,
        requested_kg=body.requested_kg,
        requested_on=req_on,
        note=body.note,
    )
    return HubRecyclingRequestResponse(
        id=req.id,
        hub_id=req.hub_id,
        hub_name=hub.name,
        material_category_id=req.material_category_id,
        material_name=material.name,
        requested_kg=float(req.requested_kg),
        fulfilled_kg=float(req.fulfilled_kg),
        note=req.note,
        requested_on=str(req.requested_on),
        status=req.status,
        created_at=req.created_at,
    )


@router.get("/requests", response_model=list[HubRecyclingRequestResponse])
async def list_hub_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub = await hub_service.get_hub_by_owner(db, user)
    if hub is None:
        raise HTTPException(status_code=404, detail="No recycling hub registered")

    reqs = await hub_service.list_requests_for_hub(db, hub.id)
    result = []
    for req in reqs:
        mat = await db.get(MaterialCategory, req.material_category_id)
        result.append(
            HubRecyclingRequestResponse(
                id=req.id,
                hub_id=req.hub_id,
                hub_name=hub.name,
                material_category_id=req.material_category_id,
                material_name=mat.name if mat else "",
                requested_kg=float(req.requested_kg),
                fulfilled_kg=float(req.fulfilled_kg),
                note=req.note,
                requested_on=str(req.requested_on),
                status=req.status,
                created_at=req.created_at,
            )
        )
    return result


@router.get("/deliveries", response_model=list[HubDeliveryResponse])
async def list_hub_deliveries(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub = await hub_service.get_hub_by_owner(db, user)
    if hub is None:
        raise HTTPException(status_code=404, detail="No recycling hub registered")
    return await hub_service.get_deliveries_for_hub(db, hub.id)


@router.post("/subscribe", response_model=HubSubscriptionResponse)
async def subscribe_hub(
    body: HubSubscriptionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub = await hub_service.get_hub_by_owner(db, user)
    if hub is None:
        raise HTTPException(status_code=404, detail="Register a recycling hub first")

    sub = await hub_service.create_subscription(
        db, hub,
        plan_name=body.plan_name,
        amount_naira=body.amount_naira,
        payment_method=body.payment_method.value if body.payment_method else None,
        payment_reference=body.payment_reference,
    )
    return sub


@router.get("/subscriptions", response_model=list[HubSubscriptionResponse])
async def list_hub_subscriptions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub = await hub_service.get_hub_by_owner(db, user)
    if hub is None:
        raise HTTPException(status_code=404, detail="No recycling hub registered")
    return await hub_service.list_subscriptions_for_hub(db, hub.id)
