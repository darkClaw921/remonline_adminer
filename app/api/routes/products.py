from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, distinct
from typing import List, Optional
from ..schemas import ProductResponse, APIResponse, ProductFilter
from ...models import Product, Warehouse, Stock, get_db
from ...services import RemonlineService
from datetime import datetime
from loguru import logger

router = APIRouter()

@router.get("/filtered", response_model=APIResponse)
async def get_products_filtered(
    skip: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
    sku: Optional[str] = None,
    category: Optional[str] = None,
    warehouse_ids: Optional[str] = Query(None, description="Comma-separated warehouse remonline IDs"),
    remonline_ids: Optional[str] = Query(None, description="Comma-separated product remonline IDs for subtab filtering"),
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    stock_min: Optional[float] = None,
    stock_max: Optional[float] = None,
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    sort_by: Optional[str] = Query("name", description="Field to sort by: name, category, price, total_stock, wh_{warehouse_id}"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_db)
):
    """Получить товары с расширенными фильтрами по складам и остаткам"""
    from sqlalchemy import func, select
    
    # Базовый запрос товаров
    query = db.query(Product)
    
    # Применяем текстовые фильтры
    if name:
        # Нечеткий поиск по названию и RemID
        query = query.filter(or_(
            Product.name.ilike(f"%{name}%"),
            Product.remonline_id.ilike(f"%{name}%")
        ))
    if sku:
        query = query.filter(Product.sku.ilike(f"%{sku}%"))
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))
    
    # Применяем фильтр по конкретным remonline_ids (для подвкладок)
    if remonline_ids:
        try:
            product_remonline_ids = [int(x.strip()) for x in remonline_ids.split(',') if x.strip()]
            if product_remonline_ids:
                query = query.filter(Product.remonline_id.in_(product_remonline_ids))
        except ValueError:
            raise HTTPException(status_code=400, detail="Некорректный формат remonline_ids")
    
    # Применяем фильтр по активности
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    
    # Применяем фильтр по цене
    if price_min is not None:
        query = query.filter(Product.price >= price_min)
    if price_max is not None:
        query = query.filter(Product.price <= price_max)
    
    # Если указаны склады, фильтруем по остаткам на этих складах
    if warehouse_ids:
        try:
            wh_remonline_ids = [int(x.strip()) for x in warehouse_ids.split(',') if x.strip()]
            if wh_remonline_ids:
                # Получаем внутренние ID складов по remonline_id одним запросом
                wh_internal_ids = db.query(Warehouse.id).filter(
                    Warehouse.remonline_id.in_(wh_remonline_ids)
                ).all()
                wh_internal_ids = [wh[0] for wh in wh_internal_ids]
                
                if wh_internal_ids:
                    # Применяем фильтр по минимальному/максимальному остатку
                    if stock_min is not None or stock_max is not None:
                        # Используем CTE для агрегации остатков
                        stock_sum_cte = db.query(
                            Stock.product_id,
                            func.sum(Stock.available_quantity).label('total_stock')
                        ).filter(
                            Stock.warehouse_id.in_(wh_internal_ids)
                        ).group_by(Stock.product_id).cte('stock_sum')
                        
                        # Применяем фильтр через JOIN
                        query = query.join(stock_sum_cte, Product.id == stock_sum_cte.c.product_id)
                        if stock_min is not None:
                            query = query.filter(stock_sum_cte.c.total_stock >= stock_min)
                        if stock_max is not None:
                            query = query.filter(stock_sum_cte.c.total_stock <= stock_max)
                    else:
                        # Простая фильтрация по наличию остатков на указанных складах
                        query = query.join(Stock).filter(
                            Stock.warehouse_id.in_(wh_internal_ids),
                            Stock.available_quantity > 0
                        ).distinct()
                else:
                    # Указанные склады не найдены
                    return APIResponse(success=True, data=[], count=0, total=0)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid warehouse_ids format")
    else:
        # Если склады не указаны, но есть фильтр по остаткам, применяем к общему остатку
        if stock_min is not None or stock_max is not None:
            stock_sum_cte = db.query(
                Stock.product_id,
                func.sum(Stock.available_quantity).label('total_stock')
            ).group_by(Stock.product_id).cte('stock_sum')
            
            query = query.join(stock_sum_cte, Product.id == stock_sum_cte.c.product_id)
            if stock_min is not None:
                query = query.filter(stock_sum_cte.c.total_stock >= stock_min)
            if stock_max is not None:
                query = query.filter(stock_sum_cte.c.total_stock <= stock_max)
    
    # Оптимизация: получаем общее количество до применения пагинации
    # Используем count() без вложенного запроса
    from sqlalchemy import func as sql_func
    total_count = query.with_entities(sql_func.count(Product.id.distinct())).scalar()
    
    # Применяем сортировку (оптимизировано с использованием CTE)
    if sort_by == "name":
        query = query.order_by(Product.name.desc() if sort_order == "desc" else Product.name.asc())
    elif sort_by == "category":
        query = query.order_by(Product.category.desc() if sort_order == "desc" else Product.category.asc())
    elif sort_by == "price":
        query = query.order_by(Product.price.desc() if sort_order == "desc" else Product.price.asc())
    elif sort_by == "total_stock":
        # Сортировка по общему остатку - используем CTE
        stock_sum_cte = db.query(
            Stock.product_id,
            func.sum(Stock.available_quantity).label('total_stock')
        ).group_by(Stock.product_id).cte('stock_sum_sort')
        
        query = query.outerjoin(stock_sum_cte, Product.id == stock_sum_cte.c.product_id)
        query = query.order_by(
            stock_sum_cte.c.total_stock.desc().nullslast() if sort_order == "desc" 
            else stock_sum_cte.c.total_stock.asc().nullslast()
        )
    elif sort_by.startswith("wh_"):
        # Сортировка по остатку на конкретном складе - используем простой subquery
        try:
            wh_remonline_id = int(sort_by.split("_")[1])
            # Получаем ID склада одним запросом
            wh_id = db.query(Warehouse.id).filter(Warehouse.remonline_id == wh_remonline_id).scalar()
            if wh_id:
                wh_stock_cte = db.query(
                    Stock.product_id,
                    Stock.available_quantity
                ).filter(Stock.warehouse_id == wh_id).cte('wh_stock_sort')
                
                query = query.outerjoin(wh_stock_cte, Product.id == wh_stock_cte.c.product_id)
                query = query.order_by(
                    wh_stock_cte.c.available_quantity.desc().nullslast() if sort_order == "desc" 
                    else wh_stock_cte.c.available_quantity.asc().nullslast()
                )
            else:
                # Склад не найден, сортировка по умолчанию
                query = query.order_by(Product.name.asc())
        except (ValueError, IndexError):
            # Неверный формат, используем сортировку по умолчанию
            query = query.order_by(Product.name.asc())
    else:
        # Сортировка по умолчанию
        query = query.order_by(Product.name.asc())
    
    # Применяем пагинацию
    products = query.offset(skip).limit(limit).all()
    
    return APIResponse(
        success=True,
        data=[ProductResponse.from_orm(product) for product in products],
        count=len(products),
        total=total_count,
        message=f"Found {total_count} products matching filters"
    )


@router.get("/", response_model=APIResponse)
async def get_products(
    skip: int = 0,
    limit: int = 100000,
    name: Optional[str] = None,
    sku: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Получить все товары с фильтрами. Максимальный лимит: 100000 товаров"""
    query = db.query(Product)

    # Применяем фильтры
    if name:
        # Нечеткий поиск по названию и RemID
        query = query.filter(or_(
            Product.name.ilike(f"%{name}%"),
            Product.remonline_id.ilike(f"%{name}%")
        ))
    if sku:
        query = query.filter(Product.sku.ilike(f"%{sku}%"))
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    products = query.offset(skip).limit(limit).all()

    return APIResponse(
        success=True,
        data=[ProductResponse.from_orm(product) for product in products],
        count=len(products)
    )

@router.get("/{product_id}", response_model=APIResponse)
async def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    """Получить товар по ID"""
    product = db.query(Product).filter(Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return APIResponse(
        success=True,
        data=ProductResponse.from_orm(product)
    )


@router.post("/{product_id}/refresh", response_model=APIResponse)
async def refresh_product(
    product_id: int,
    warehouse_id: Optional[int] = Query(None, description="Remonline ID склада для точечного обновления"),
    db: Session = Depends(get_db)
):
    """Принудительно обновить товар и его остатки (как во flow), пройдясь по активным складам Remonline."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.remonline_id:
        raise HTTPException(status_code=400, detail="Product has no remonline_id")

    good_id = product.remonline_id
    if warehouse_id is not None:
        wh = db.query(Warehouse).filter(Warehouse.remonline_id == warehouse_id, Warehouse.is_active == True).first()
        if not wh:
            raise HTTPException(status_code=404, detail="Warehouse not found or inactive")
        warehouses: list[Warehouse] = [wh]
    else:
        warehouses: list[Warehouse] = db.query(Warehouse).filter_by(is_active=True).all()

    try:
        logger.info(f"Начинаем обновление товара ID {product_id} (Remonline ID: {good_id}) по {len(warehouses)} складам")
        
        async with RemonlineService() as service:
            # Обновление товара и остатков - ищем на первом попавшемся складе
            updated_fields = False
            stocks_updated = 0
            warehouses_checked = 0
            
            for wh in warehouses:
                warehouses_checked += 1
                logger.info(f"Проверяем склад {warehouses_checked}/{len(warehouses)}: {wh.name} (ID: {wh.remonline_id})")
                
                try:
                    # Используем параметр ids[] для запроса конкретного товара
                    response = await service._make_request(
                        f"warehouse/goods/{wh.remonline_id}",
                        params={"ids[]": good_id}
                    )
                    
                    items = response.get("data", [])
                    if not items or not isinstance(items, list) or len(items) == 0:
                        logger.debug(f"Товар {good_id} не найден на складе {wh.name}")
                        continue
                    
                    matched = items[0]
                    if not isinstance(matched, dict) or matched.get("id") != good_id:
                        continue
                    
                    logger.info(f"✅ Товар найден на складе {wh.name}")

                    # Поля товара
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
                    quantity = matched.get("residue", 0.0) or 0.0

                    price_value = None
                    if isinstance(prices_json, dict) and prices_json:
                        non_zero = [v for v in prices_json.values() if isinstance(v, (int, float)) and v]
                        price_value = (non_zero[0] if non_zero else list(prices_json.values())[0])

                    # Логируем найденные данные
                    logger.info(f"📦 Обновляем поля товара:")
                    logger.info(f"   Название: {product_name}")
                    logger.info(f"   Артикул: {product_sku}")
                    if prices_json:
                        logger.info(f"   Цены: {prices_json}")
                    logger.info(f"   Категория: {category_json.get('title') if isinstance(category_json, dict) else category_json}")
                    
                    # Применяем обновления полей
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

                    updated_fields = True
                    logger.info(f"✅ Поля товара обновлены")
                    
                    # Обновляем остатки на этом же складе
                    logger.info(f"💰 Обновляем остатки на складе {wh.name}: {quantity}")
                    stock = db.query(Stock).filter_by(
                        warehouse_id=wh.id,
                        product_id=product.id,
                    ).first()
                    if not stock:
                        stock = Stock(
                            warehouse_id=wh.id,
                            product_id=product.id,
                            quantity=quantity,
                            reserved_quantity=0,
                            available_quantity=quantity,
                        )
                        db.add(stock)
                        logger.info(f"   ➕ Создана новая запись об остатках")
                    else:
                        old_quantity = stock.quantity
                        stock.quantity = quantity
                        stock.available_quantity = quantity
                        logger.info(f"   🔄 Остатки обновлены: {old_quantity} → {quantity}")
                    
                    stocks_updated = 1
                    db.commit()
                    
                    # Товар найден и обновлен - прекращаем поиск
                    logger.info(f"✅ Товар полностью обновлен на складе {wh.name}")
                    break
                    
                except Exception as e:
                    logger.warning(f"Ошибка проверки на складе {wh.name}: {e}")
                    continue

        # Явно обновим timestamp, чтобы фронт отобразил актуальную дату
        product.updated_at = datetime.utcnow()
        db.commit()
        
        if updated_fields:
            result_message = f"Товар успешно обновлен (поля и остатки) на складе"
        else:
            result_message = f"Товар не найден ни на одном из {len(warehouses)} складов"
        logger.info(f"🎉 {result_message}")
        
        return APIResponse(
            success=True, 
            data={
                "product_id": product.id,
                "fields_updated": updated_fields,
                "stocks_updated": stocks_updated,
                "warehouses_total": len(warehouses)
            }, 
            message=result_message
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-from-remonline/{remonline_id}", response_model=APIResponse)
async def create_product_from_remonline(
    remonline_id: int,
    db: Session = Depends(get_db)
):
    """Создать товар в локальной БД из Remonline по ID"""
    import asyncio
    from loguru import logger
    
    # Проверяем, нет ли уже такого товара
    existing_product = db.query(Product).filter(Product.remonline_id == remonline_id).first()
    if existing_product:
        return APIResponse(
            success=True,
            data=ProductResponse.from_orm(existing_product),
            message="Product already exists in database"
        )

    # Получаем активные склады (ограничиваем до 3 для параллельного поиска)
    warehouses = db.query(Warehouse).filter_by(is_active=True).limit(3).all()
    if not warehouses:
        raise HTTPException(status_code=400, detail="No active warehouses found")

    try:
        async with RemonlineService() as service:
            logger.info(f"Поиск товара {remonline_id} по {len(warehouses)} складам")
            
            # Функция для поиска товара на конкретном складе через параметр ids[]
            async def search_product_on_warehouse(wh: Warehouse):
                try:
                    logger.info(f"Запрос товара {remonline_id} со склада {wh.name} (ID: {wh.remonline_id})")
                    
                    # Используем параметр ids[] для запроса конкретного товара
                    response = await service._make_request(
                        f"warehouse/goods/{wh.remonline_id}",
                        params={"ids[]": remonline_id}
                    )
                    
                    # Проверяем, есть ли товар в ответе
                    items = response.get("data", [])
                    if items and isinstance(items, list) and len(items) > 0:
                        item = items[0]
                        if isinstance(item, dict) and item.get("id") == remonline_id:
                            logger.info(f"✓ Товар {remonline_id} найден на складе {wh.name}")
                            return item
                    
                    logger.info(f"Товар {remonline_id} не найден на складе {wh.name}")
                    return None
                except Exception as e:
                    logger.warning(f"Ошибка поиска на складе {wh.name} (ID: {wh.remonline_id}): {e}")
                    return None
            
            # Запускаем параллельный поиск по всем складам
            search_tasks = [search_product_on_warehouse(wh) for wh in warehouses]
            results = await asyncio.gather(*search_tasks, return_exceptions=True)
            
            # Находим первый успешный результат
            found_product_data = None
            for result in results:
                if isinstance(result, dict) and result:
                    found_product_data = result
                    break

            if not found_product_data:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Product with Remonline ID {remonline_id} not found on any active warehouse"
                )

            # Создаём товар в БД
            product_name = found_product_data.get("title", "")
            product_sku = found_product_data.get("article", "")
            barcodes_list = found_product_data.get("barcodes", []) or []
            product_barcode = None
            if isinstance(barcodes_list, list) and barcodes_list:
                first_barcode = barcodes_list[0]
                if isinstance(first_barcode, dict):
                    product_barcode = first_barcode.get("code")

            # Извлекаем цену
            price_value = None
            prices_json = found_product_data.get("price")
            if isinstance(prices_json, dict) and prices_json:
                for price_key in ["purchase", "cost", "retail"]:
                    if price_key in prices_json:
                        price_data = prices_json[price_key]
                        if isinstance(price_data, dict) and "value" in price_data:
                            price_value = float(price_data["value"])
                            break

            # Создаём новый товар
            new_product = Product(
                remonline_id=remonline_id,
                name=product_name,
                sku=product_sku,
                barcode=product_barcode,
                description=found_product_data.get("description", ""),
                price=price_value,
                category=found_product_data.get("category", {}).get("title") if found_product_data.get("category") else None,
                images_json=found_product_data.get("image"),
                prices_json=prices_json,
                uom_json=found_product_data.get("uom"),
                category_json=found_product_data.get("category"),
                custom_fields_json=found_product_data.get("custom_fields"),
                is_serial=bool(found_product_data.get("is_serial", False)),
                warranty=found_product_data.get("warranty"),
                warranty_period=found_product_data.get("warranty_period"),
                is_active=True
            )

            db.add(new_product)
            db.commit()
            db.refresh(new_product)

            logger.info(f"Создан товар {new_product.name} (ID: {new_product.id}, Remonline ID: {remonline_id})")

            return APIResponse(
                success=True,
                data=ProductResponse.from_orm(new_product),
                message=f"Product created successfully from Remonline ID {remonline_id}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка создания товара из Remonline: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating product: {str(e)}")


@router.put("/{product_id}/activate", response_model=APIResponse)
async def activate_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    """Активировать товар"""
    from loguru import logger
    
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product.is_active = True
        db.commit()
        db.refresh(product)
        
        logger.info(f"Товар {product.name} (ID: {product.id}) активирован")
        
        return APIResponse(
            success=True,
            data=ProductResponse.from_orm(product),
            message="Product activated successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка активации товара: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error activating product")


@router.get("/remonline/{remonline_id}", response_model=APIResponse)
async def get_product_by_remonline_id(
    remonline_id: int,
    db: Session = Depends(get_db)
):
    """Получить товар по Remonline ID"""
    product = db.query(Product).filter(Product.remonline_id == remonline_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return APIResponse(
        success=True,
        data=ProductResponse.from_orm(product)
    )
