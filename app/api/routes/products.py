from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from ..schemas import ProductResponse, APIResponse, ProductFilter
from ...models import Product, Warehouse, Stock, get_db
from ...services import RemonlineService

router = APIRouter()

@router.get("/", response_model=APIResponse)
async def get_products(
    skip: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
    sku: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Получить все товары с фильтрами"""
    query = db.query(Product)

    # Применяем фильтры
    if name:
        query = query.filter(Product.name.ilike(f"%{name}%"))
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
        async with RemonlineService() as service:
            # Обновление полей товара — найдём первую встречу на любом складе
            updated_fields = False
            for wh in warehouses:
                try:
                    async for goods_page in service._iterate_paginated(f"warehouse/goods/{wh.remonline_id}"):
                        matched = None
                        for item in goods_page:
                            if isinstance(item, dict) and item.get("id") == good_id:
                                matched = item
                                break
                        if matched is None:
                            continue

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

                        price_value = None
                        if isinstance(prices_json, dict) and prices_json:
                            non_zero = [v for v in prices_json.values() if isinstance(v, (int, float)) and v]
                            price_value = (non_zero[0] if non_zero else list(prices_json.values())[0])

                        # Применяем обновления
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

                        db.commit()
                        updated_fields = True
                        break
                except Exception:
                    continue
                if updated_fields:
                    break

            # Обновление остатков на всех активных складах
            for wh in warehouses:
                found_on_wh = False
                try:
                    async for goods_page in service._iterate_paginated(f"warehouse/goods/{wh.remonline_id}"):
                        for item in goods_page:
                            if isinstance(item, dict) and item.get("id") == good_id:
                                quantity = item.get("residue", 0.0) or 0.0
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
                                else:
                                    stock.quantity = quantity
                                    stock.available_quantity = quantity
                                found_on_wh = True
                                break
                        db.commit()
                        if found_on_wh:
                            break
                except Exception:
                    continue

        return APIResponse(success=True, data={"product_id": product.id}, message="Product refreshed")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

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
