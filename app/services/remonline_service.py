import httpx
import asyncio
import os
from typing import List, Dict, Any, Optional
from loguru import logger
from ..core.config import settings
from ..models import Warehouse, Product, Stock, LastUpdate
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

VERIFY_SSL = os.getenv("VERIFY_SSL", False)

class RemonlineService:
    def __init__(self):
        self.api_key = settings.REMONLINE_API_KEY
        self.base_url = settings.REMONLINE_API_URL
        # Отключаем проверку SSL для тестирования (можно настроить через переменную окружения)
        verify_ssl = VERIFY_SSL
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers=headers,
            verify=False
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def _make_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Выполнить запрос к API Remonline"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        params_str = f" with params: {params}" if params else ""
        logger.info(f"Making request to {url}{params_str}")

        try:
            response = await self.client.get(url, params=params)
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            raise

    async def _fetch_all_paginated(self, endpoint: str, base_params: Optional[Dict[str, Any]] = None, delay_seconds: float = 0.35) -> List[Dict[str, Any]]:
        """Загрузить все элементы постранично (page=1..N, до <50 на странице) c троттлингом."""
        collected: List[Dict[str, Any]] = []
        seen_ids = set()
        page = 1

        while True:
            params = dict(base_params or {})
            params.update({"page": page})

            logger.info(f"Paginated fetch: endpoint={endpoint}, page={page}")
            response = await self._make_request(endpoint, params=params)
            page_items = response.get("data", [])

            if not isinstance(page_items, list):
                logger.warning("Unexpected response shape for paginated fetch; stopping")
                break

            if not page_items:
                break

            # Дедупликация по id
            new_items: List[Dict[str, Any]] = []
            for item in page_items:
                item_id = None
                if isinstance(item, dict):
                    item_id = item.get("id")
                if item_id is not None and item_id in seen_ids:
                    continue
                if item_id is not None:
                    seen_ids.add(item_id)
                new_items.append(item)

            if not new_items:
                logger.warning("No new items detected on this page; stopping to avoid infinite loop")
                break

            collected.extend(new_items)

            # Остановка, если на странице <50 элементов
            if len(page_items) < 50:
                break

            page += 1
            await asyncio.sleep(delay_seconds)

        logger.info(f"Paginated fetch collected {len(collected)} items from {endpoint}")
        return collected

    async def _iterate_paginated(self, endpoint: str, base_params: Optional[Dict[str, Any]] = None, delay_seconds: float = 0.35):
        """Итерировать по страницам, возвращая список элементов на каждой странице.

        Остановка, когда на странице < 50 элементов. Дедупликация по id.
        """
        seen_ids = set()
        page = 1

        while True:
            params = dict(base_params or {})
            params.update({"page": page})

            logger.info(f"Paginated iterate: endpoint={endpoint}, page={page}")
            response = await self._make_request(endpoint, params=params)
            page_items = response.get("data", [])

            if not isinstance(page_items, list):
                logger.warning("Unexpected response shape for paginated iterate; stopping")
                return

            if not page_items:
                return

            new_items: List[Dict[str, Any]] = []
            for item in page_items:
                item_id = None
                if isinstance(item, dict):
                    item_id = item.get("id")
                if item_id is not None and item_id in seen_ids:
                    continue
                if item_id is not None:
                    seen_ids.add(item_id)
                new_items.append(item)

            if not new_items:
                logger.warning("No new items detected on this page; stopping to avoid infinite loop")
                return

            yield new_items

            if len(page_items) < 50:
                return

            page += 1
            await asyncio.sleep(delay_seconds)

    async def get_warehouses(self) -> List[Dict[str, Any]]:
        """Получить список складов (постранично до <50 элементов на странице)."""
        return await self._fetch_all_paginated("warehouse/")

    async def get_warehouse_goods(self, warehouse_id: int) -> List[Dict[str, Any]]:
        """Получить остатки товаров на складе (постранично до <50 элементов на странице)."""
        return await self._fetch_all_paginated(f"warehouse/goods/{warehouse_id}")

    async def fetch_goods_page(self, warehouse_rem_id: int, page: int) -> List[Dict[str, Any]]:
        """Получить одну страницу остатков по складу (для управляемого конвейера)."""
        params = {"page": page}
        response = await self._make_request(f"warehouse/goods/{warehouse_rem_id}", params=params)
        data = response.get("data", [])
        if not isinstance(data, list):
            return []
        return data

    async def get_postings(self, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Получить список поставок товаров"""
        response = await self._make_request("warehouse/postings/", params)
        return response.get("data", [])

    async def get_good_details(self, warehouse_id: int, good_id: int) -> Dict[str, Any]:
        """Получить детали товара с серийными номерами"""
        response = await self._make_request(f"warehouse/goods/{warehouse_id}/{good_id}")
        return response.get("data", {})

    def _extract_bool(self, value: Any, default: bool = True) -> bool:
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            normalized = value.strip().lower()
            return normalized in {"1", "true", "yes", "y", "on", "enabled"}
        return default

    def _map_warehouse_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Маппинг полей склада с учетом возможных алиасов из API Remonline."""
        # Часто встречающиеся варианты по опыту интеграций
        rem_id = (
            data.get("id")
            or data.get("warehouse_id")
            or data.get("remonline_id")
        )

        name = (
            data.get("name")
            or data.get("title")
            or data.get("warehouse_name")
            or ""
        )

        address = (
            data.get("address")
            or data.get("location")
            or data.get("address_line")
            or data.get("address1")
            or ""
        )

        active_raw = (
            data.get("active")
            or data.get("is_active")
            or data.get("enabled")
            or data.get("status")
        )
        is_active = self._extract_bool(active_raw, default=True)

        return {
            "remonline_id": rem_id,
            "name": name,
            "address": address,
            "is_active": is_active,
        }

    async def sync_warehouses(self, db: Session) -> None:
        """Синхронизировать склады с API"""
        try:
            total = 0
            async for warehouses_page in self._iterate_paginated("warehouse/"):
                logger.info(f"Processing warehouses page with {len(warehouses_page)} items")

                for warehouse_data in warehouses_page:
                   

                    mapped = self._map_warehouse_fields(warehouse_data if isinstance(warehouse_data, dict) else {})
                    rem_id = mapped.get("remonline_id")
                    if rem_id is None:
                        logger.warning(f"Skip warehouse without id: {warehouse_data}")
                        continue

                    warehouse = db.query(Warehouse).filter_by(remonline_id=rem_id).first()
                    if not warehouse:
                        warehouse = Warehouse(
                            remonline_id=rem_id,
                            name=mapped["name"],
                            address=mapped["address"],
                            is_active=mapped["is_active"],
                        )
                        db.add(warehouse)
                    else:
                        warehouse.name = mapped["name"] or warehouse.name
                        warehouse.address = mapped["address"] or warehouse.address
                        warehouse.is_active = mapped["is_active"] if mapped["is_active"] is not None else warehouse.is_active

                    total += 1

                # Обновить время последнего обновления и коммит после страницы
                last_update = db.query(LastUpdate).filter_by(entity_type="warehouses").first()
                if not last_update:
                    last_update = LastUpdate(entity_type="warehouses")
                    db.add(last_update)

                db.commit()
                logger.info("Warehouses page committed")

            logger.info(f"Warehouses synchronized successfully, total processed: {total}")

        except Exception as e:
            logger.error(f"Failed to sync warehouses: {str(e)}")
            db.rollback()
            raise

    async def sync_products_and_stocks(self, db: Session) -> None:
        """Синхронизировать товары и остатки с API"""
        try:
            warehouses = db.query(Warehouse).filter_by(is_active=True).all()

            for warehouse in warehouses:
                try:
                    async for goods_page in self._iterate_paginated(f"warehouse/goods/{warehouse.remonline_id}"):
                        logger.info(f"Processing {len(goods_page)} goods for warehouse {warehouse.name}")

                        for good_data in goods_page:
                            # Отладка структуры данных
                            logger.debug(f"Good data structure: {good_data}")

                        # Синхронизация товара
                        # Используем поле 'id' как ID товара
                        good_id = good_data.get("id")
                        if not good_id:
                            logger.error(f"Cannot find good_id in data: {good_data}")
                            continue

                        product = db.query(Product).filter_by(remonline_id=good_id).first()
                        # Извлекаем основные поля
                        product_name = good_data.get("title", "")
                        product_sku = good_data.get("article", "")
                        product_code = good_data.get("code")
                        barcodes_list = good_data.get("barcodes", []) or []
                        product_barcode = None
                        if isinstance(barcodes_list, list) and barcodes_list:
                            first_barcode = barcodes_list[0]
                            if isinstance(first_barcode, dict):
                                product_barcode = first_barcode.get("code")

                        # Композитные поля
                        uom_json = good_data.get("uom")
                        images_json = good_data.get("image")
                        prices_json = good_data.get("price")
                        category_json = good_data.get("category")
                        custom_fields_json = good_data.get("custom_fields")
                        is_serial = bool(good_data.get("is_serial", False))
                        warranty = good_data.get("warranty")
                        warranty_period = good_data.get("warranty_period")
                        description = good_data.get("description")

                        # Выберем одно число цены (если нужно в старом поле price)
                        price_value = None
                        if isinstance(prices_json, dict) and prices_json:
                            # берём первое ненулевое или первое попавшееся
                            non_zero = [v for v in prices_json.values() if isinstance(v, (int, float)) and v]
                            price_value = (non_zero[0] if non_zero else list(prices_json.values())[0])

                        if not product:
                            product = Product(
                                remonline_id=good_id,
                                name=product_name,
                                sku=product_sku,
                                barcode=product_barcode,
                                code=product_code,
                                uom_json=uom_json,
                                images_json=images_json,
                                prices_json=prices_json,
                                category_json=category_json,
                                category=(category_json.get("title") if isinstance(category_json, dict) else None),
                                custom_fields_json=custom_fields_json,
                                barcodes_json=barcodes_list,
                                is_serial=is_serial,
                                warranty=warranty,
                                warranty_period=warranty_period,
                                description=description,
                                price=price_value,
                            )
                            db.add(product)
                            db.flush()  # Получить ID товара
                        else:
                            product.name = product_name or product.name
                            product.sku = product_sku or product.sku
                            if product_barcode:
                                product.barcode = product_barcode
                            if product_code:
                                product.code = product_code
                            # перезаписываем композитные
                            if uom_json is not None:
                                product.uom_json = uom_json
                            if images_json is not None:
                                product.images_json = images_json
                            if prices_json is not None:
                                product.prices_json = prices_json
                            if category_json is not None:
                                product.category_json = category_json
                                if isinstance(category_json, dict):
                                    # Храним в строковом поле только название категории
                                    title_value = category_json.get("title")
                                    if title_value:
                                        product.category = title_value
                            if custom_fields_json is not None:
                                product.custom_fields_json = custom_fields_json
                            if barcodes_list is not None:
                                product.barcodes_json = barcodes_list
                            product.is_serial = is_serial
                            if warranty is not None:
                                product.warranty = warranty
                            if warranty_period is not None:
                                product.warranty_period = warranty_period
                            if description is not None:
                                product.description = description
                            if price_value is not None:
                                product.price = price_value
                                # Синхронизация остатков
                                # Используем поле 'residue' как количество товара
                                quantity = good_data.get("residue", 0.0)

                                stock = db.query(Stock).filter_by(
                                    warehouse_id=warehouse.id,
                                    product_id=product.id
                                ).first()

                                if not stock:
                                    stock = Stock(
                                        warehouse_id=warehouse.id,
                                        product_id=product.id,
                                        quantity=quantity,
                                        reserved_quantity=0,  # В API нет этого поля
                                        available_quantity=quantity  # Предполагаем, что все доступно
                                    )
                                    db.add(stock)
                                else:
                                    stock.quantity = quantity
                                    stock.available_quantity = quantity

                        # Обновить время последнего обновления и коммит после страницы
                        last_update = db.query(LastUpdate).filter_by(entity_type="products_stocks").first()
                        if not last_update:
                            last_update = LastUpdate(entity_type="products_stocks")
                            db.add(last_update)

                    db.commit()
                    logger.info(f"Committed goods page for warehouse {warehouse.name}")
                except Exception as warehouse_error:
                    logger.warning(f"Failed to get goods for warehouse {warehouse.name} (ID: {warehouse.remonline_id}): {str(warehouse_error)}")
                    continue

            logger.info("Products and stocks synchronized successfully")

        except Exception as e:
            logger.error(f"Failed to sync products and stocks: {str(e)}")
            db.rollback()
            raise

    async def sync_products_and_stocks_for_warehouse(self, db: Session, warehouse: Warehouse) -> None:
        """Синхронизировать товары и остатки для одного склада (для прогресса по складам)."""
        try:
            async for goods_page in self._iterate_paginated(f"warehouse/goods/{warehouse.remonline_id}"):
                logger.info(f"Processing {len(goods_page)} goods for warehouse {warehouse.name}")

                for good_data in goods_page:
                    good_id = good_data.get("id")
                    if not good_id:
                        logger.error(f"Cannot find good_id in data: {good_data}")
                        continue

                    product = db.query(Product).filter_by(remonline_id=good_id).first()

                    product_name = good_data.get("title", "")
                    product_sku = good_data.get("article", "")
                    product_code = good_data.get("code")
                    barcodes_list = good_data.get("barcodes", []) or []
                    product_barcode = None
                    if isinstance(barcodes_list, list) and barcodes_list:
                        first_barcode = barcodes_list[0]
                        if isinstance(first_barcode, dict):
                            product_barcode = first_barcode.get("code")

                    uom_json = good_data.get("uom")
                    images_json = good_data.get("image")
                    prices_json = good_data.get("price")
                    category_json = good_data.get("category")
                    custom_fields_json = good_data.get("custom_fields")
                    is_serial = bool(good_data.get("is_serial", False))
                    warranty = good_data.get("warranty")
                    warranty_period = good_data.get("warranty_period")
                    description = good_data.get("description")

                    price_value = None
                    if isinstance(prices_json, dict) and prices_json:
                        non_zero = [v for v in prices_json.values() if isinstance(v, (int, float)) and v]
                        price_value = (non_zero[0] if non_zero else list(prices_json.values())[0])

                    if not product:
                        product = Product(
                            remonline_id=good_id,
                            name=product_name,
                            sku=product_sku,
                            barcode=product_barcode,
                            code=product_code,
                            uom_json=uom_json,
                            images_json=images_json,
                            prices_json=prices_json,
                            category_json=category_json,
                            category=(category_json.get("title") if isinstance(category_json, dict) else None),
                            custom_fields_json=custom_fields_json,
                            barcodes_json=barcodes_list,
                            is_serial=is_serial,
                            warranty=warranty,
                            warranty_period=warranty_period,
                            description=description,
                            price=price_value,
                        )
                        db.add(product)
                        db.flush()
                    else:
                        product.name = product_name or product.name
                        product.sku = product_sku or product.sku
                        if product_barcode:
                            product.barcode = product_barcode
                        if product_code:
                            product.code = product_code
                        if uom_json is not None:
                            product.uom_json = uom_json
                        if images_json is not None:
                            product.images_json = images_json
                        if prices_json is not None:
                            product.prices_json = prices_json
                        if category_json is not None:
                            product.category_json = category_json
                            if isinstance(category_json, dict):
                                title_value = category_json.get("title")
                                if title_value:
                                    product.category = title_value
                        if custom_fields_json is not None:
                            product.custom_fields_json = custom_fields_json
                        if barcodes_list is not None:
                            product.barcodes_json = barcodes_list
                        product.is_serial = is_serial
                        if warranty is not None:
                            product.warranty = warranty
                        if warranty_period is not None:
                            product.warranty_period = warranty_period
                        if description is not None:
                            product.description = description
                        if price_value is not None:
                            product.price = price_value

                        # Остатки
                    quantity = good_data.get("residue", 0.0)
                    stock = db.query(Stock).filter_by(
                        warehouse_id=warehouse.id,
                        product_id=product.id,
                    ).first()
                    if not stock:
                        stock = Stock(
                            warehouse_id=warehouse.id,
                            product_id=product.id,
                            quantity=quantity,
                            reserved_quantity=0,
                            available_quantity=quantity,
                        )
                        db.add(stock)
                    else:
                        stock.quantity = quantity
                        stock.available_quantity = quantity

                # Коммит после страницы
                last_update = db.query(LastUpdate).filter_by(entity_type="products_stocks").first()
                if not last_update:
                    last_update = LastUpdate(entity_type="products_stocks")
                    db.add(last_update)
                db.commit()
                logger.info(f"Committed goods page for warehouse {warehouse.name}")
        except Exception as e:
            logger.error(f"Failed to sync goods for warehouse {warehouse.name}: {str(e)}")
            db.rollback()
            raise
