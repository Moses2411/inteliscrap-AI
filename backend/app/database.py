from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    import app.models  # noqa: F401 — register all tables before create_all

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.config import settings
    from app.seed import seed_material_categories

    async with async_session_factory() as session:
        await seed_material_categories(session)
        if settings.debug and settings.seed_demo_data:
            from app.seed_demo import seed_demo_data

            await seed_demo_data(session)
        await session.commit()


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
