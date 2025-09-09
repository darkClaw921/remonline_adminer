import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from loguru import logger
import asyncio

from app.models import Base, engine
from app.api import api_router
from app.services import BackgroundService
from app.core.config import settings

# Создаем таблицы в базе данных
Base.metadata.create_all(bind=engine)

# Создаем FastAPI приложение
app = FastAPI(
    title="Remonline Adminer API",
    description="API для работы с данными Remonline",
    version="1.0.0"
)

# Настраиваем CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем API роуты
app.include_router(api_router, prefix="/api/v1")

# Создаем экземпляр сервиса фоновых задач
background_service = BackgroundService()

@app.on_event("startup")
async def startup_event():
    """Действия при запуске приложения"""
    logger.info("Starting Remonline Adminer API")
    logger.info(f"Database URL: {settings.DATABASE_URL}")
    logger.info(f"Update interval: {settings.UPDATE_INTERVAL_MINUTES} minutes")

    # Запускаем фоновые задачи
    # await background_service.start_background_tasks()

@app.on_event("shutdown")
async def shutdown_event():
    """Действия при остановке приложения"""
    logger.info("Shutting down Remonline Adminer API")
    await background_service.stop_background_tasks()

@app.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "Remonline Adminer API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# Статика и страница продуктов
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/products")
async def products_page():
    """Страница со списком товаров и остатками по ключевым складам"""
    return FileResponse("app/static/products.html")

@app.get("/health")
async def health_check():
    """Проверка здоровья приложения"""
    return {
        "status": "healthy",
        "database": "connected",
        "background_tasks": background_service.is_running
    }

def main():
    """Запуск приложения"""
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )

if __name__ == "__main__":
    main()
