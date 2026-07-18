from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./inteliscrap.db"
    database_sync_url: str = "sqlite:///./inteliscrap.db"
    cors_origins: str = "*"
    app_name: str = "InteliScrap API"
    debug: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
