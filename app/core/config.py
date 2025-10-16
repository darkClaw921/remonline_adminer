from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # API Remonline настройки
    REMONLINE_API_KEY: str = os.getenv("REMONLINE_API_KEY", "")
    REMONLINE_API_URL: str = "https://api.roapp.io"

    # PostgreSQL настройки
    USER_DB: str = os.getenv("USER_DB", "")
    PASSWORD_DB: str = os.getenv("PASSWORD_DB", "")
    HOST_DB: str = os.getenv("HOST_DB", "")
    NAME_DB: str = os.getenv("NAME_DB", "remonline_db")
    
    # База данных - формируем DATABASE_URL из PostgreSQL переменных
    @property
    def DATABASE_URL(self) -> str:
        if self.USER_DB and self.PASSWORD_DB and self.HOST_DB:
            # Разбираем HOST_DB на хост и порт если есть
            if ":" in self.HOST_DB:
                host, port = self.HOST_DB.rsplit(":", 1)
                return f"postgresql://{self.USER_DB}:{self.PASSWORD_DB}@{host}:{port}/{self.NAME_DB}"
            else:
                return f"postgresql://{self.USER_DB}:{self.PASSWORD_DB}@{self.HOST_DB}:5432/{self.NAME_DB}"
        # Fallback на переменную окружения или SQLite (для локальной разработки)
        return os.getenv("DATABASE_URL", "sqlite:///./remonline.db")

    # Настройки приложения
    DEBUG: bool = os.getenv("DEBUG", False)
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    PORT: int = int(os.getenv("PORT", 8000))

    # Настройки обновления данных
    UPDATE_INTERVAL_MINUTES: int = int(os.getenv("UPDATE_INTERVAL_MINUTES", "30"))

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"  # Игнорировать дополнительные поля в .env
    }

settings = Settings()
