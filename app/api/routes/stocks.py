from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional
from ..schemas import StockResponse, APIResponse
from ...models import Stock, Warehouse, Product, get_db
from ...services import RemonlineService
from ...models.database import SessionLocal
from loguru import logger
import asyncio
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=APIResponse)
async def get_stocks(
    skip: int = 0,
    limit: int = 100,
    warehouse_id: Optional[int] = None,
    product_id: Optional[int] = None,
    min_quantity: Optional[float] = None,
    max_quantity: Optional[float] = None,
    include_details: bool = False,
    db: Session = Depends(get_db)
):
    """Получить все остатки товаров с фильтрами"""
    query = db.query(Stock)

    # Применяем фильтры
    if warehouse_id:
        query = query.filter(Stock.warehouse_id == warehouse_id)
    if product_id:
        query = query.filter(Stock.product_id == product_id)
    if min_quantity is not None:
        query = query.filter(Stock.quantity >= min_quantity)
    if max_quantity is not None:
        query = query.filter(Stock.quantity <= max_quantity)

    # Загружаем связанные данные если нужно
    if include_details:
        query = query.options(
            joinedload(Stock.warehouse),
            joinedload(Stock.product)
        )

    stocks = query.offset(skip).limit(limit).all()

    return APIResponse(
        success=True,
        data=[StockResponse.from_orm(stock) for stock in stocks],
        count=len(stocks)
    )

# =====================
# Автосинхронизация по всем складам (прогресс)
# =====================

_sync_lock = asyncio.Lock()
_sync_state = {
    "status": "idle",  # idle | running | finished | failed
    "processed": 0,
    "total": 0,
    "started_at": None,
    "finished_at": None,
    "message": None,
    "active": False,
}
_sync_task: Optional[asyncio.Task] = None


async def _run_full_sync_task():
    global _sync_state
    db = SessionLocal()
    try:
        warehouses: List[Warehouse] = db.query(Warehouse).filter_by(is_active=True).all()
        total = len(warehouses)
        _sync_state.update({
            "status": "running",
            "processed": 0,
            "total": total,
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": None,
            "message": None,
            "active": True,
        })

        # Конвейер 3 RPS по складам, приоритет API, пакетные апсерты
        async with RemonlineService() as service:
            # Соберём по всем складам первую страницу параллельно тройками, затем следующую и т.д.
            # Для пакетных апсёртов — агрегируем продукты и остатки, потом одним коммитом
            page_index_by_wh = {wh.remonline_id: 1 for wh in warehouses}
            finished_wh = set()

            async def fetch_one_page(wh: Warehouse, page: int):
                try:
                    items = await service.fetch_goods_page(wh.remonline_id, page)
                    return (wh, page, items)
                except Exception as e:
                    logger.warning(f"Fetch failed wh={wh.remonline_id} page={page}: {e}")
                    return (wh, page, [])

            # Пока есть склады с незакрытыми страницами — запускаем пачки по 3 запроса
            while len(finished_wh) < len(warehouses):
                batch_tasks = []
                for wh in warehouses:
                    if wh.remonline_id in finished_wh:
                        continue
                    # набираем до 3 задач
                    if len(batch_tasks) < 3:
                        page = page_index_by_wh[wh.remonline_id]
                        batch_tasks.append(asyncio.create_task(fetch_one_page(wh, page)))
                if not batch_tasks:
                    break

                results = await asyncio.gather(*batch_tasks, return_exceptions=False)

                # Пакетная обработка результатов и запись в БД одной транзакцией
                try:
                    products_to_upsert = []  # список словарей
                    stocks_to_upsert = []    # список словарей

                    for wh, page, items in results:
                        if not items:
                            # Пустая страница — склад закончен
                            finished_wh.add(wh.remonline_id)
                            continue
                        # Подготовка данных
                        for good_data in items:
                            if not isinstance(good_data, dict):
                                continue
                            good_id = good_data.get("id")
                            if not good_id:
                                continue
                            # извлекаем поля продукта
                            barcodes_list = good_data.get("barcodes", []) or []
                            product_barcode = None
                            if isinstance(barcodes_list, list) and barcodes_list:
                                first_barcode = barcodes_list[0]
                                if isinstance(first_barcode, dict):
                                    product_barcode = first_barcode.get("code")

                            prices_json = good_data.get("price")
                            price_value = None
                            if isinstance(prices_json, dict) and prices_json:
                                non_zero = [v for v in prices_json.values() if isinstance(v, (int, float)) and v]
                                price_value = (non_zero[0] if non_zero else list(prices_json.values())[0])

                            products_to_upsert.append({
                                "remonline_id": good_id,
                                "name": good_data.get("title", ""),
                                "sku": good_data.get("article", ""),
                                "barcode": product_barcode,
                                "code": good_data.get("code"),
                                "uom_json": good_data.get("uom"),
                                "images_json": good_data.get("image"),
                                "prices_json": prices_json,
                                "category_json": good_data.get("category"),
                                "custom_fields_json": good_data.get("custom_fields"),
                                "barcodes_json": barcodes_list,
                                "is_serial": bool(good_data.get("is_serial", False)),
                                "warranty": good_data.get("warranty"),
                                "warranty_period": good_data.get("warranty_period"),
                                "description": good_data.get("description"),
                                "price": price_value,
                            })

                            quantity = good_data.get("residue", 0.0) or 0.0
                            stocks_to_upsert.append({
                                "warehouse_id": wh.id,
                                "product_rem_id": good_id,
                                "quantity": quantity,
                            })

                        # Для этого склада есть следующая страница
                        page_index_by_wh[wh.remonline_id] = page + 1

                    # Оптимизированные апсерты одним проходом
                    from ...models import Product, Stock
                    from sqlalchemy.dialects.postgresql import insert as pg_insert
                    
                    # Получаем существующие продукты одним запросом с индексом
                    remonline_ids = [x["remonline_id"] for x in products_to_upsert]
                    existing_products = {
                        p.remonline_id: p 
                        for p in db.query(Product).filter(Product.remonline_id.in_(remonline_ids)).all()
                    }

                    # Разделяем на новые и обновляемые продукты
                    products_to_insert = []
                    products_to_update = []
                    
                    for pdata in products_to_upsert:
                        category_title = None
                        if isinstance(pdata.get("category_json"), dict):
                            category_title = pdata["category_json"].get("title")
                        
                        product_data = {
                            "remonline_id": pdata["remonline_id"],
                            "name": pdata["name"],
                            "sku": pdata["sku"],
                            "barcode": pdata["barcode"],
                            "code": pdata["code"],
                            "uom_json": pdata["uom_json"],
                            "images_json": pdata["images_json"],
                            "prices_json": pdata["prices_json"],
                            "category_json": pdata["category_json"],
                            "category": category_title,
                            "custom_fields_json": pdata["custom_fields_json"],
                            "barcodes_json": pdata["barcodes_json"],
                            "is_serial": pdata["is_serial"],
                            "warranty": pdata["warranty"],
                            "warranty_period": pdata["warranty_period"],
                            "description": pdata["description"],
                            "price": pdata["price"],
                        }
                        
                        if pdata["remonline_id"] not in existing_products:
                            products_to_insert.append(product_data)
                        else:
                            product_data["id"] = existing_products[pdata["remonline_id"]].id
                            products_to_update.append(product_data)
                    
                    # Bulk insert новых товаров
                    if products_to_insert:
                        db.bulk_insert_mappings(Product, products_to_insert)
                        db.flush()
                        # Обновляем кэш существующих продуктов
                        new_products = db.query(Product).filter(Product.remonline_id.in_(remonline_ids)).all()
                        existing_products = {p.remonline_id: p for p in new_products}
                    
                    # Bulk update существующих товаров
                    if products_to_update:
                        db.bulk_update_mappings(Product, products_to_update)

                    # Оптимизированные апсерты по остаткам
                    rem_to_id = {rem_id: prod.id for rem_id, prod in existing_products.items()}
                    
                    # Получаем существующие остатки для этой пачки
                    stock_keys = [(sdata["warehouse_id"], rem_to_id.get(sdata["product_rem_id"])) 
                                  for sdata in stocks_to_upsert 
                                  if rem_to_id.get(sdata["product_rem_id"])]
                    
                    existing_stocks = {}
                    if stock_keys:
                        product_ids = [k[1] for k in stock_keys]
                        warehouse_ids = list(set(k[0] for k in stock_keys))
                        stocks_query = db.query(Stock).filter(
                            Stock.warehouse_id.in_(warehouse_ids),
                            Stock.product_id.in_(product_ids)
                        ).all()
                        existing_stocks = {(s.warehouse_id, s.product_id): s for s in stocks_query}
                    
                    stocks_to_insert = []
                    stocks_to_update = []
                    
                    for sdata in stocks_to_upsert:
                        prod_id = rem_to_id.get(sdata["product_rem_id"])
                        if not prod_id:
                            continue
                        
                        stock_key = (sdata["warehouse_id"], prod_id)
                        stock_data = {
                            "warehouse_id": sdata["warehouse_id"],
                            "product_id": prod_id,
                            "quantity": sdata["quantity"],
                            "reserved_quantity": 0,
                            "available_quantity": sdata["quantity"],
                        }
                        
                        if stock_key not in existing_stocks:
                            stocks_to_insert.append(stock_data)
                        else:
                            stock_data["id"] = existing_stocks[stock_key].id
                            stocks_to_update.append(stock_data)
                    
                    # Bulk operations для остатков
                    if stocks_to_insert:
                        db.bulk_insert_mappings(Stock, stocks_to_insert)
                    if stocks_to_update:
                        db.bulk_update_mappings(Stock, stocks_to_update)

                    # Коммит одним разом за пачку результатов
                    db.commit()
                except Exception as e:
                    logger.exception(f"Batch upsert failed: {e}")
                    db.rollback()

                # Пауза до следующей секунды чтобы держать 3 RPS
                await asyncio.sleep(1)

                # Обновим прогресс по завершённым складам (когда они получили пустую страницу)
                _sync_state["processed"] = len(finished_wh)

        _sync_state.update({
            "status": "finished",
            "finished_at": datetime.utcnow().isoformat(),
            "message": "Sync completed",
            "active": False,
        })
    except Exception as e:
        logger.exception(f"Full sync failed: {e}")
        _sync_state.update({
            "status": "failed",
            "finished_at": datetime.utcnow().isoformat(),
            "message": str(e),
            "active": False,
        })
    finally:
        db.close()


@router.post("/sync_all", response_model=APIResponse)
async def sync_all_stocks():
    """Запустить полную синхронизацию остатков по всем активным складам (неблокирующе)."""
    global _sync_task
    async with _sync_lock:
        if _sync_state.get("status") == "running":
            return APIResponse(success=True, data=_sync_state, message="Already running")
        # старт новой задачи
        _sync_task = asyncio.create_task(_run_full_sync_task())
        return APIResponse(success=True, data=_sync_state, message="Started")


@router.get("/sync_progress", response_model=APIResponse)
async def get_sync_progress():
    """Получить текущий прогресс автосинхронизации по складам."""
    return APIResponse(success=True, data=_sync_state)

@router.get("/{stock_id}", response_model=APIResponse)
async def get_stock(
    stock_id: int,
    include_details: bool = False,
    db: Session = Depends(get_db)
):
    """Получить остаток товара по ID"""
    query = db.query(Stock).filter(Stock.id == stock_id)

    if include_details:
        query = query.options(
            joinedload(Stock.warehouse),
            joinedload(Stock.product)
        )

    stock = query.first()

    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    return APIResponse(
        success=True,
        data=StockResponse.from_orm(stock)
    )

@router.get("/warehouse/{warehouse_id}", response_model=APIResponse)
async def get_stocks_by_warehouse(
    warehouse_id: int,
    skip: int = 0,
    limit: int = 100,
    include_details: bool = True,
    db: Session = Depends(get_db)
):
    """Получить остатки товаров на складе"""
    # Проверяем существует ли склад
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    query = db.query(Stock).filter(Stock.warehouse_id == warehouse_id)

    if include_details:
        query = query.options(
            joinedload(Stock.warehouse),
            joinedload(Stock.product)
        )

    stocks = query.offset(skip).limit(limit).all()

    return APIResponse(
        success=True,
        data=[StockResponse.from_orm(stock) for stock in stocks],
        count=len(stocks),
        message=f"Stocks for warehouse {warehouse.name}"
    )

@router.get("/product/{product_id}", response_model=APIResponse)
async def get_stocks_by_product(
    product_id: int,
    include_details: bool = True,
    db: Session = Depends(get_db)
):
    """Получить остатки товара по всем складам"""
    # Проверяем существует ли товар
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    query = db.query(Stock).filter(Stock.product_id == product_id)

    if include_details:
        query = query.options(
            joinedload(Stock.warehouse),
            joinedload(Stock.product)
        )

    stocks = query.all()

    return APIResponse(
        success=True,
        data=[StockResponse.from_orm(stock) for stock in stocks],
        count=len(stocks),
        message=f"Stocks for product {product.name}"
    )
