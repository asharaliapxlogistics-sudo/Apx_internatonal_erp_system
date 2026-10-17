from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings read from backend/.env."""

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parent.parent / ".env", env_file_encoding="utf-8")

    db_host: str = "127.0.0.1"
    db_port: int = 3307
    db_name: str = "apx_erp"
    db_user: str = "apx_erp"
    db_password: str = ""
    cors_origins: str = "http://localhost:5190"

    # Office time zone: decides what "today" means and how booking times are shown.
    timezone: str = "Asia/Karachi"

    jwt_secret: str = ""
    # Login lifetime: a work shift normally, longer with "Keep me signed in".
    token_hours: int = 12
    remember_days: int = 30
    # Wrong-password lockout per email + IP address.
    login_max_failures: int = 5
    login_lock_minutes: int = 15

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
