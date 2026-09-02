import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import analyze, auth, health, impact, listings, materials, outbox, prices, sync, transactions, tts, users, ussd, voice
from app.config import settings
from app.database import async_session_factory, init_db
from app.middleware.cors import setup_cors
from app.services import outbox_service


async def _outbox_worker() -> None:
    while True:
        try:
            async with async_session_factory() as session:
                await outbox_service.process_pending(session)
                await session.commit()
        except Exception:
            pass
        await asyncio.sleep(settings.outbox_poll_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    task = asyncio.create_task(_outbox_worker()) if settings.outbox_worker_enabled else None
    try:
        yield
    finally:
        if task is not None:
            task.cancel()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

setup_cors(app)

app.include_router(health.router)
app.include_router(sync.router)
app.include_router(users.router)
app.include_router(prices.router)
app.include_router(analyze.router)
app.include_router(tts.router)
app.include_router(ussd.router)
app.include_router(voice.router)
app.include_router(transactions.router)
app.include_router(impact.router)
app.include_router(listings.router)
app.include_router(materials.router)
app.include_router(auth.router)
app.include_router(outbox.router)


@app.get("/")
async def root():
    return {"app": settings.app_name, "status": "running"}
