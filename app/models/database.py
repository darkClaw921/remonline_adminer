from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.core.config import settings

# Используем DATABASE_URL из настроек
DATABASE_URL = settings.DATABASE_URL

# Настройки для PostgreSQL (оптимизированные для производительности)
engine_kwargs = {}
if "postgresql" in DATABASE_URL:
    engine_kwargs["pool_pre_ping"] = True  # Проверка соединений перед использованием
    engine_kwargs["pool_size"] = 20  # Увеличенный размер пула соединений
    engine_kwargs["max_overflow"] = 40  # Увеличенное количество дополнительных соединений
    engine_kwargs["pool_recycle"] = 3600  # Переиспользование соединений каждый час
    engine_kwargs["pool_timeout"] = 30  # Таймаут ожидания соединения из пула
    engine_kwargs["echo_pool"] = False  # Отключаем логирование пула для производительности
    # Оптимизация выполнения запросов
    engine_kwargs["execution_options"] = {
        "isolation_level": "READ COMMITTED"  # Оптимальный уровень изоляции для большинства операций
    }
elif "sqlite" in DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
