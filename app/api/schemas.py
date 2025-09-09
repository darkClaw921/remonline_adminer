from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

# Схемы для складов
class WarehouseBase(BaseModel):
    remonline_id: int
    name: str
    address: Optional[str] = None
    is_active: bool = True

class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Схемы для товаров
class ProductBase(BaseModel):
    remonline_id: int
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    is_active: bool = True

class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    images_json: Optional[Any] = None
    prices_json: Optional[Any] = None

    class Config:
        from_attributes = True

# Схемы для остатков
class StockBase(BaseModel):
    warehouse_id: int
    product_id: int
    quantity: float
    reserved_quantity: float = 0
    available_quantity: float

class StockResponse(StockBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    warehouse: Optional[WarehouseResponse] = None
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

# Схемы для фильтров
class ProductFilter(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class StockFilter(BaseModel):
    warehouse_id: Optional[int] = None
    product_id: Optional[int] = None
    min_quantity: Optional[float] = None
    max_quantity: Optional[float] = None

# Схемы для ответов API
class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    count: Optional[int] = None

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int
