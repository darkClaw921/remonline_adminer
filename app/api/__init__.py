from fastapi import APIRouter
from .routes.warehouses import router as warehouses_router
from .routes.products import router as products_router
from .routes.stocks import router as stocks_router

api_router = APIRouter()

# Подключаем роуты
api_router.include_router(
    warehouses_router,
    prefix="/warehouses",
    tags=["warehouses"]
)

api_router.include_router(
    products_router,
    prefix="/products",
    tags=["products"]
)

api_router.include_router(
    stocks_router,
    prefix="/stocks",
    tags=["stocks"]
)

__all__ = ["api_router"]
