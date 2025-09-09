from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from ..schemas import ProductResponse, APIResponse, ProductFilter
from ...models import Product, get_db

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
