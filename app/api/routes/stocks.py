from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional
from ..schemas import StockResponse, APIResponse
from ...models import Stock, Warehouse, Product, get_db

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
