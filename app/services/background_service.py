import asyncio
from datetime import datetime, timedelta
from loguru import logger
from ..models import get_db
from ..services.remonline_service import RemonlineService
from ..core.config import settings

class BackgroundService:
    def __init__(self):
        self.is_running = False
        self.update_interval = timedelta(minutes=settings.UPDATE_INTERVAL_MINUTES)

    async def start_background_tasks(self):
        """Запустить фоновые задачи"""
        if self.is_running:
            logger.warning("Background tasks are already running")
            return

        self.is_running = True
        logger.info(f"Starting background tasks with {settings.UPDATE_INTERVAL_MINUTES} minutes interval")

        # Запускаем задачу обновления данных
        asyncio.create_task(self._data_update_loop())

    async def stop_background_tasks(self):
        """Остановить фоновые задачи"""
        self.is_running = False
        logger.info("Background tasks stopped")

    async def _data_update_loop(self):
        """Цикл обновления данных"""
        while self.is_running:
            try:
                await self._update_all_data()
                logger.info(f"Data update completed. Next update in {settings.UPDATE_INTERVAL_MINUTES} minutes")
            except Exception as e:
                logger.error(f"Data update failed: {str(e)}")

            # Ждем до следующего обновления
            await asyncio.sleep(self.update_interval.total_seconds())

    async def _update_all_data(self):
        """Обновить все данные из API"""
        async with RemonlineService() as service:
            for db in get_db():
                try:
                    logger.info("Starting warehouses sync...")
                    await service.sync_warehouses(db)

                    logger.info("Starting products and stocks sync...")
                    await service.sync_products_and_stocks(db)

                    logger.info("Data sync completed successfully")
                    break

                except Exception as e:
                    logger.error(f"Database sync failed: {str(e)}")
                    continue
                finally:
                    db.close()

    async def update_data_now(self):
        """Принудительно обновить данные"""
        logger.info("Manual data update requested")
        await self._update_all_data()
        logger.info("Manual data update completed")
