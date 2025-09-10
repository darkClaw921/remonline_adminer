import asyncio
from loguru import logger

from app.core.config import settings
from app.services import RemonlineService
from app.models import Base, engine
from app.models.database import SessionLocal
from sqlalchemy import text


async def sync_warehouses_to_db() -> None:
    """Получить все склады из Remonline и записать их в базу данных."""
    logger.info("Starting warehouses synchronization flow")

    # Убедимся, что таблицы созданы
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        async with RemonlineService() as service:
            await service.sync_warehouses(db)
        logger.info("Warehouses synchronization flow finished successfully")
    except Exception as error:
        logger.exception(f"Warehouses synchronization flow failed: {error}")
        raise
    finally:
        db.close()


def _ensure_products_extended_columns() -> None:
    """Лёгкая миграция: добавить недостающие колонки в products перед синхронизацией."""
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(products)")).fetchall()
        existing = {row[1] for row in rows}
        columns_spec = [
            ("code", "TEXT", None),
            ("uom_json", "JSON", None),
            ("images_json", "JSON", None),
            ("prices_json", "JSON", None),
            ("category_json", "JSON", None),
            ("custom_fields_json", "JSON", None),
            ("barcodes_json", "JSON", None),
            ("is_serial", "INTEGER", "0"),
            ("warranty", "INTEGER", None),
            ("warranty_period", "INTEGER", None),
        ]
        for name, type_sql, default in columns_spec:
            if name not in existing:
                sql = f"ALTER TABLE products ADD COLUMN {name} {type_sql}"
                if default is not None:
                    sql += f" DEFAULT {default}"
                conn.execute(text(sql))
                logger.info(f"Added missing column products.{name}")


async def sync_stocks_for_warehouse_37746() -> None:
    """Получить остатки (товары + количества) для склада 37746 и записать в БД."""
    logger.info("Starting stocks synchronization flow for warehouse 37746")

    Base.metadata.create_all(bind=engine)
    _ensure_products_extended_columns()

    db = SessionLocal()
    try:
        async with RemonlineService() as service:
            # Убедимся, что склад существует в БД
            from app.models import Warehouse, Product, Stock, LastUpdate

            warehouse = db.query(Warehouse).filter(Warehouse.remonline_id == 37746).first()
            if not warehouse:
                logger.warning("Warehouse 37746 not found in DB. Creating placeholder record.")
                warehouse = Warehouse(remonline_id=37746, name="Warehouse 37746", is_active=True)
                db.add(warehouse)
                db.flush()

            async for goods_page in service._iterate_paginated(f"warehouse/goods/{37746}"):
                logger.info(f"Processing page with {len(goods_page)} goods for warehouse 37746")

                for good_data in goods_page:
                    # ID товара (обязателен)
                    good_id = good_data.get("id")
                    if not good_id:
                        logger.error(f"Skip good without id: {good_data}")
                        continue

                # Основные поля
                product_name = good_data.get("title", "")
                product_sku = good_data.get("article", "")
                product_code = good_data.get("code")
                barcodes_list = good_data.get("barcodes", []) or []
                product_barcode = None
                if isinstance(barcodes_list, list) and barcodes_list:
                    first_barcode = barcodes_list[0]
                    if isinstance(first_barcode, dict):
                        product_barcode = first_barcode.get("code")

                # Композитные/доп. поля
                uom_json = good_data.get("uom")
                images_json = good_data.get("image")
                prices_json = good_data.get("price")
                category_json = good_data.get("category")
                custom_fields_json = good_data.get("custom_fields")
                is_serial = bool(good_data.get("is_serial", False))
                warranty = good_data.get("warranty")
                warranty_period = good_data.get("warranty_period")
                description = good_data.get("description")

                # Одно число цены (если нужно агрегировать)
                price_value = None
                if isinstance(prices_json, dict) and prices_json:
                    non_zero = [v for v in prices_json.values() if isinstance(v, (int, float)) and v]
                    price_value = (non_zero[0] if non_zero else list(prices_json.values())[0])

                # Апсерт товара
                product = db.query(Product).filter_by(remonline_id=good_id).first()
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

                # Количество
                quantity = good_data.get("residue", 0.0) or 0.0

                # Апсерт остатков
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
                db.commit()
                logger.info("Committed goods page for warehouse 37746")

            # отметка обновления
            last_update = db.query(LastUpdate).filter_by(entity_type="products_stocks").first()
            if not last_update:
                last_update = LastUpdate(entity_type="products_stocks")
                db.add(last_update)

            db.commit()
            logger.info("Stocks synchronization for warehouse 37746 finished successfully")
    except Exception as error:
        logger.exception(f"Stocks synchronization for warehouse 37746 failed: {error}")
        raise
    finally:
        db.close()


def main() -> None:
    logger.info(f"Database URL: {settings.DATABASE_URL}")
    asyncio.run(sync_warehouses_to_db())
    # asyncio.run(sync_stocks_for_warehouse_37746())
    # asyncio.run(update_first_product_and_stocks())


async def update_first_product_and_stocks() -> None:
    """Найти самый первый товар в БД, обновить его поля и остатки по всем активным складам.

    - Поиск первого товара: products.id ASC
    - Обновление полей товара: из страницы, где товар найден (title, article, code, uom, image, price, category, custom_fields, barcodes, is_serial, warranty, warranty_period, description)
    - Обновление остатков: для каждого активного склада найти товар в постраничном листинге и обновить quantity/available_quantity
    - Коммиты: после каждой страницы
    """
    logger.info("Starting update_first_product_and_stocks flow")
    Base.metadata.create_all(bind=engine)
    _ensure_products_extended_columns()

    db = SessionLocal()
    try:
        from app.models import Product, Warehouse, Stock

        first_product: Product | None = db.query(Product).order_by(Product.id.asc()).first()
        if not first_product:
            logger.warning("No products found in DB to update")
            return

        good_id = first_product.remonline_id
        if not good_id:
            logger.warning("First product has no remonline_id; skip")
            return

        async with RemonlineService() as service:
            # Обновление полей товара — найдём любую страницу, где встречается товар
            warehouses: list[Warehouse] = db.query(Warehouse).filter_by(is_active=True).all()
            updated_fields = False

            for wh in warehouses:
                try:
                    async for goods_page in service._iterate_paginated(f"warehouse/goods/{wh.remonline_id}"):
                        # Попробуем найти товар на странице
                        matched = None
                        for item in goods_page:
                            if isinstance(item, dict) and item.get("id") == good_id:
                                matched = item
                                break

                        if matched is None:
                            # Коммит пустой страницы не нужен — продолжаем
                            continue

                        # Обновим поля товара по найденной записи
                        product_name = matched.get("title", "")
                        product_sku = matched.get("article", "")
                        product_code = matched.get("code")
                        barcodes_list = matched.get("barcodes", []) or []
                        product_barcode = None
                        if isinstance(barcodes_list, list) and barcodes_list:
                            first_barcode = barcodes_list[0]
                            if isinstance(first_barcode, dict):
                                product_barcode = first_barcode.get("code")

                        uom_json = matched.get("uom")
                        images_json = matched.get("image")
                        prices_json = matched.get("price")
                        category_json = matched.get("category")
                        custom_fields_json = matched.get("custom_fields")
                        is_serial = bool(matched.get("is_serial", False))
                        warranty = matched.get("warranty")
                        warranty_period = matched.get("warranty_period")
                        description = matched.get("description")

                        price_value = None
                        if isinstance(prices_json, dict) and prices_json:
                            non_zero = [v for v in prices_json.values() if isinstance(v, (int, float)) and v]
                            price_value = (non_zero[0] if non_zero else list(prices_json.values())[0])

                        # Применяем обновления
                        first_product.name = product_name or first_product.name
                        first_product.sku = product_sku or first_product.sku
                        if product_barcode:
                            first_product.barcode = product_barcode
                        if product_code:
                            first_product.code = product_code
                        if uom_json is not None:
                            first_product.uom_json = uom_json
                        if images_json is not None:
                            first_product.images_json = images_json
                        if prices_json is not None:
                            first_product.prices_json = prices_json
                        if category_json is not None:
                            first_product.category_json = category_json
                            if isinstance(category_json, dict):
                                title_value = category_json.get("title")
                                if title_value:
                                    first_product.category = title_value
                        if custom_fields_json is not None:
                            first_product.custom_fields_json = custom_fields_json
                        if barcodes_list is not None:
                            first_product.barcodes_json = barcodes_list
                        first_product.is_serial = is_serial
                        if warranty is not None:
                            first_product.warranty = warranty
                        if warranty_period is not None:
                            first_product.warranty_period = warranty_period
                        if description is not None:
                            first_product.description = description
                        if price_value is not None:
                            first_product.price = price_value

                        db.commit()
                        logger.info(f"Product id={first_product.id} updated from warehouse {wh.name}")
                        updated_fields = True
                        break
                except Exception as e:
                    logger.warning(f"Skip warehouse {wh.remonline_id} for product update due to error: {e}")
                    continue

                if updated_fields:
                    break

            # Обновление остатков этого товара по всем активным складам
            for wh in warehouses:
                found_on_wh = False
                try:
                    async for goods_page in service._iterate_paginated(f"warehouse/goods/{wh.remonline_id}"):
                        for item in goods_page:
                            if isinstance(item, dict) and item.get("id") == good_id:
                                quantity = item.get("residue", 0.0) or 0.0
                                stock = db.query(Stock).filter_by(
                                    warehouse_id=wh.id,
                                    product_id=first_product.id,
                                ).first()
                                if not stock:
                                    stock = Stock(
                                        warehouse_id=wh.id,
                                        product_id=first_product.id,
                                        quantity=quantity,
                                        reserved_quantity=0,
                                        available_quantity=quantity,
                                    )
                                    db.add(stock)
                                else:
                                    stock.quantity = quantity
                                    stock.available_quantity = quantity

                                found_on_wh = True
                                break

                        db.commit()
                        logger.info(f"Committed stock page for product id={first_product.id} warehouse={wh.name}")

                        if found_on_wh:
                            # Страницы дальше для этого склада не нужны
                            break
                except Exception as e:
                    logger.warning(f"Skip warehouse {wh.remonline_id} for stock update due to error: {e}")
                    continue

        logger.info("update_first_product_and_stocks flow finished successfully")
    except Exception as error:
        logger.exception(f"update_first_product_and_stocks flow failed: {error}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()


