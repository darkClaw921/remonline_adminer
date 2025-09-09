from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..schemas import WarehouseResponse, APIResponse
from ...models import Warehouse, get_db

router = APIRouter()

@router.get("/", response_model=APIResponse)
async def get_warehouses(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Получить все склады"""
    query = db.query(Warehouse)

    if active_only:
        query = query.filter(Warehouse.is_active == True)

    warehouses = query.offset(skip).limit(limit).all()

    return APIResponse(
        success=True,
        data=[WarehouseResponse.from_orm(warehouse) for warehouse in warehouses],
        count=len(warehouses)
    )

@router.get("/{warehouse_id}", response_model=APIResponse)
async def get_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db)
):
    """Получить склад по ID"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()

    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    return APIResponse(
        success=True,
        data=WarehouseResponse.from_orm(warehouse)
    )

@router.get("/remonline/{remonline_id}", response_model=APIResponse)
async def get_warehouse_by_remonline_id(
    remonline_id: int,
    db: Session = Depends(get_db)
):
    """Получить склад по Remonline ID"""
    warehouse = db.query(Warehouse).filter(Warehouse.remonline_id == remonline_id).first()

    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    return APIResponse(
        success=True,
        data=WarehouseResponse.from_orm(warehouse)
    )
