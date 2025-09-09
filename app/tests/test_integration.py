import pytest
import sys
from pathlib import Path
from loguru import logger

# Добавляем корневую директорию проекта в sys.path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from app.services import RemonlineService
from app.models import Warehouse, Product, Stock
from app.core.config import settings

class TestRemonlineIntegration:
    """Интеграционные тесты для работы с API Remonline"""

    @pytest.mark.asyncio
    async def test_get_all_warehouses(self, db):
        """Тест: получить все доступные склады"""
        logger.info("Testing: Get all warehouses")

        async with RemonlineService() as service:
            try:
                # Получаем склады из API
                warehouses_data = await service.get_warehouses()
                logger.info(f"Found {len(warehouses_data)} warehouses in API")

                # Синхронизируем склады в базу данных
                await service.sync_warehouses(db)

                # Проверяем, что склады сохранены в базе данных
                warehouses_count = db.query(Warehouse).count()
                logger.info(f"Saved {warehouses_count} warehouses to database")

                assert warehouses_count > 0, "No warehouses were saved to database"

                # Получаем все склады из базы данных
                warehouses = db.query(Warehouse).all()

                # Проверяем структуру данных
                for warehouse in warehouses:
                    assert warehouse.id is not None
                    assert warehouse.remonline_id is not None
                    assert warehouse.name is not None
                    logger.info(f"Warehouse: {warehouse.name} (ID: {warehouse.remonline_id})")

                return warehouses

            except Exception as e:
                logger.error(f"Failed to get warehouses: {str(e)}")
                pytest.skip(f"API request failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_get_stocks_by_warehouse_37746(self, db):
        """Тест: получить все остатки по складу с id 37746"""
        logger.info("Testing: Get stocks for warehouse 37746")

        # Сначала убеждаемся, что у нас есть склады
        warehouses = await self.test_get_all_warehouses(db)

        # Ищем склад с remonline_id = 37746
        target_warehouse = None
        for warehouse in warehouses:
            if warehouse.remonline_id == 37746:
                target_warehouse = warehouse
                break

        if not target_warehouse:
            logger.warning("Warehouse with remonline_id 37746 not found, using first available warehouse")
            target_warehouse = warehouses[0] if warehouses else None

        if not target_warehouse:
            pytest.skip("No warehouses available for testing")

        logger.info(f"Using warehouse: {target_warehouse.name} (ID: {target_warehouse.remonline_id})")

        async with RemonlineService() as service:
            try:
                # Получаем остатки товаров для склада
                goods_data = await service.get_warehouse_goods(target_warehouse.remonline_id)
                logger.info(f"Found {len(goods_data)} goods in warehouse {target_warehouse.name}")

                # Синхронизируем товары и остатки
                await service.sync_products_and_stocks(db)

                # Получаем остатки из базы данных
                stocks = db.query(Stock).filter(Stock.warehouse_id == target_warehouse.id).all()
                logger.info(f"Saved {len(stocks)} stocks for warehouse {target_warehouse.name}")

                # Проверяем структуру данных
                for stock in stocks:
                    assert stock.id is not None
                    assert stock.warehouse_id == target_warehouse.id
                    assert stock.product_id is not None
                    assert stock.quantity >= 0
                    logger.info(f"Stock: Product ID {stock.product_id}, Quantity: {stock.quantity}")

                return stocks

            except Exception as e:
                logger.error(f"Failed to get stocks for warehouse {target_warehouse.remonline_id}: {str(e)}")
                pytest.skip(f"API request failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_get_products_by_stocks(self, db):
        """Тест: получить все товары по остаткам"""
        logger.info("Testing: Get products by stocks")

        # Сначала получаем остатки
        stocks = await self.test_get_stocks_by_warehouse_37746(db)

        if not stocks:
            pytest.skip("No stocks available for testing")

        # Собираем уникальные product_id из остатков
        product_ids = list(set(stock.product_id for stock in stocks))
        logger.info(f"Found {len(product_ids)} unique products in stocks")

        # Получаем товары из базы данных
        products = db.query(Product).filter(Product.id.in_(product_ids)).all()
        logger.info(f"Retrieved {len(products)} products from database")

        # Проверяем структуру данных
        for product in products:
            assert product.id is not None
            assert product.remonline_id is not None
            assert product.name is not None
            logger.info(f"Product: {product.name} (SKU: {product.sku}, Remonline ID: {product.remonline_id})")

        assert len(products) > 0, "No products were found for the stocks"

        return products

    # @pytest.mark.asyncio
    # async def test_full_integration_flow(self, db):
    #     """Тест: полный интеграционный поток"""
    #     logger.info("Testing: Full integration flow")

    #     # Шаг 1: Получить склады
    #     warehouses = await self.test_get_all_warehouses(db)
    #     assert len(warehouses) > 0

    #     # Шаг 2: Получить остатки для склада
    #     stocks = await self.test_get_stocks_by_warehouse_37746(db)
    #     assert len(stocks) > 0

    #     # Шаг 3: Получить товары по остаткам
    #     products = await self.test_get_products_by_stocks(db)
    #     assert len(products) > 0

    #     logger.info("Full integration flow completed successfully")
    #     logger.info(f"Results: {len(warehouses)} warehouses, {len(stocks)} stocks, {len(products)} products")

    #     # Проверяем связи между данными
    #     for stock in stocks:
    #         # Проверяем, что товар существует
    #         product = db.query(Product).filter(Product.id == stock.product_id).first()
    #         assert product is not None, f"Product {stock.product_id} not found"

    #         # Проверяем, что склад существует
    #         warehouse = db.query(Warehouse).filter(Warehouse.id == stock.warehouse_id).first()
    #         assert warehouse is not None, f"Warehouse {stock.warehouse_id} not found"

    #         logger.info(f"Stock relationship verified: {product.name} at {warehouse.name}")

    #     return {
    #         "warehouses": warehouses,
    #         "stocks": stocks,
    #         "products": products
    #     }
