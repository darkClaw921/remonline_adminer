from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # API Remonline настройки
    REMONLINE_API_KEY: str = os.getenv("REMONLINE_API_KEY", "")
    REMONLINE_API_URL: str = "https://api.roapp.io"

    # База данных
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./remonline.db")

    # Настройки приложения
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Настройки обновления данных
    UPDATE_INTERVAL_MINUTES: int = int(os.getenv("UPDATE_INTERVAL_MINUTES", "30"))

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"  # Игнорировать дополнительные поля в .env
    }

settings = Settings()
