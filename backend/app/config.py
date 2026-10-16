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
    h3_resolution: int = 8
    h3_search_k: int = 8
    platform_fee_rate: float = 0.05
    jwt_secret_key: str = "inteliscrap-dev-secret-key-change-in-production-32b"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080
    otp_expire_seconds: int = 600
    mock_otp: bool = True
    mock_otp_code: str = "123456"
    seed_demo_data: bool = True
    outbox_worker_enabled: bool = True
    outbox_poll_seconds: int = 60
    voice_public_base_url: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_vision_model: str = "llava:13b"
    ollama_timeout_s: int = 60
    ollama_max_retries: int = 2
    enable_server_vision: bool = True

    # Pricing/Impact
    price_stale_hours: int = 72
    enable_realtime_prices: bool = False

    # Proof-of-handover
    # A collector confirms delivery with a 6-digit PIN the seller enters. New
    # leads/listings are held while a handover is unresolved; if it is not
    # confirmed within the window it is escalated to "disputed" for an admin.
    handover_pin_ttl_hours: int = 168
    handover_confirm_window_hours: int = 4
    handover_pin_max_attempts: int = 5

    # MTN MoMo Collections (Request to Pay) — subscription payments.
    # The subscription key is the Collections product key from the MoMo
    # Developer Portal (primary *or* secondary). The API user (a UUID) and API
    # key are created once from that key via POST /api/v1/payments/momo/provision
    # in the sandbox, then pasted here (or into Render env vars). Left disabled
    # by default so nothing tries to reach MTN until it is explicitly switched on.
    momo_enabled: bool = False
    momo_base_url: str = "https://sandbox.momodeveloper.mtn.com"
    momo_subscription_key: str = ""
    momo_api_user: str = ""
    momo_api_key: str = ""
    momo_target_environment: str = "sandbox"
    momo_currency: str = "EUR"
    # Public base URL MoMo can POST the final payment status back to (the Render
    # backend URL). When blank, callbacks are skipped and the app relies on
    # status polling instead.
    momo_callback_base_url: str = ""
    momo_http_timeout_s: int = 20
    momo_token_skew_s: int = 60
    # Country code used to turn local numbers (0803...) into MSISDNs (234803...).
    momo_msisdn_country_code: str = "234"

    # Telco flags
    sms_enabled: bool = False
    ussd_enabled: bool = True
    ivr_enabled: bool = True
    max_sms_retries: int = 5
    provider_timeout_s: int = 30

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
