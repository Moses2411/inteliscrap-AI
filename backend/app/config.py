from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./inteliscrap.db"
    database_sync_url: str = "sqlite:///./inteliscrap.db"
    cors_origins: str = "*"
    app_name: str = "InteliScrap API"
    debug: bool = True

    africastalking_username: str = ""
    africastalking_api_key: str = ""
    africastalking_sender_id: str = "INTELISCRAP"
    africastalking_virtual_number: str = ""
    voice_asr_url: str = ""
    voice_tts_url: str = ""
    dispatch_radius_m: int = 5000
    dispatch_max_collectors: int = 5
    platform_fee_rate: float = 0.05
    jwt_secret_key: str = "inteliscrap-dev-secret-key-change-in-production-32b"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080
    otp_expire_seconds: int = 600
    outbox_worker_enabled: bool = True
    outbox_poll_seconds: int = 60
    voice_public_base_url: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
