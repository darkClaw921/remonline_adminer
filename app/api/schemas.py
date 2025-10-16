from pydantic import BaseModel
from typing import List, Optional, Any, Dict, Union
from datetime import datetime


class WarehouseResponse(BaseModel):
    id: int
    remonline_id: int
    name: str
    address: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    id: int
    remonline_id: int
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    images_json: Optional[Union[List[Any], Dict[str, Any]]] = None
    prices_json: Optional[Union[Dict[str, Any], List[Any]]] = None

    class Config:
        from_attributes = True


class StockResponse(BaseModel):
    id: int
    warehouse_id: int
    product_id: int
    quantity: int
    reserved_quantity: int
    available_quantity: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    warehouse: Optional[WarehouseResponse] = None
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True


class SyncProgressResponse(BaseModel):
    processed: int
    total: int
    status: str
    current_warehouse: Optional[str] = None


# Схемы для вкладок
class TabBase(BaseModel):
    name: str
    order_index: int = 0
    is_active: bool = True
    main_tab_type: Optional[str] = None  # apple, android или null


class TabCreate(TabBase):
    pass


class TabUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None
    main_tab_type: Optional[str] = None


class TabReorder(BaseModel):
    new_order: int


class SubTabBase(BaseModel):
    name: str
    order_index: int = 0
    is_active: bool = True


class SubTabCreate(SubTabBase):
    tab_id: int


class SubTabUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None


class SubTabProductBase(BaseModel):
    product_remonline_id: int
    custom_name: Optional[str] = None
    custom_category: Optional[str] = None
    order_index: int = 0
    is_active: bool = True


class SubTabProductCreate(SubTabProductBase):
    subtab_id: int


class SubTabProductUpdate(BaseModel):
    custom_name: Optional[str] = None
    custom_category: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None


class SubTabProductResponse(BaseModel):
    id: int
    subtab_id: int
    product_remonline_id: int
    custom_name: Optional[str] = None
    custom_category: Optional[str] = None
    order_index: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubTabResponse(BaseModel):
    id: int
    tab_id: int
    name: str
    order_index: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    products: List[SubTabProductResponse] = []

    class Config:
        from_attributes = True


class TabResponse(BaseModel):
    id: int
    name: str
    order_index: int
    is_active: bool
    main_tab_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    subtabs: List[SubTabResponse] = []

    class Config:
        from_attributes = True


class TabListResponse(BaseModel):
    """Упрощенная схема для быстрой загрузки списка вкладок без подвкладок"""
    id: int
    name: str
    order_index: int
    is_active: bool
    main_tab_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubTabListResponse(BaseModel):
    """Упрощенная схема для быстрой загрузки списка подвкладок без товаров"""
    id: int
    tab_id: int
    name: str
    order_index: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Общие схемы для API ответов
class APIResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None
    count: Optional[int] = None


# Схемы для фильтрации
class ProductFilter(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    warehouse_ids: Optional[List[int]] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    stock_min: Optional[int] = None
    stock_max: Optional[int] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = "asc"
    skip: int = 0
    limit: int = 50