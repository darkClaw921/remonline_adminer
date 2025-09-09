import pytest
import asyncio
import sys
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Добавляем корневую директорию проекта в sys.path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from app.models import Base, get_db
from main import app
from app.services import BackgroundService

# Тестовая база данных
TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def event_loop():
    """Создать event loop для тестов"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
def db():
    """Фикстура для тестовой базы данных"""
    # Создаем таблицы
    Base.metadata.create_all(bind=engine)

    # Создаем сессию
    db = TestingSessionLocal()

    try:
        yield db
    finally:
        db.rollback()
        db.close()

    # Удаляем таблицы после теста
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client():
    """Фикстура для тестового клиента"""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(scope="function")
def background_service():
    """Фикстура для сервиса фоновых задач"""
    service = BackgroundService()
    return service
