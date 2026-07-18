from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import analyze, health, prices, sync, users
from app.config import settings
from app.database import init_db
from app.middleware.cors import setup_cors


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


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


@app.get("/")
async def root():
    return {"app": settings.app_name, "status": "running"}
