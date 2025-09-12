from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from loguru import logger

from ...models import get_db, Tab, SubTab, SubTabProduct
from ..schemas import (
    TabResponse, TabCreate, TabUpdate, TabReorder,
    SubTabResponse, SubTabCreate, SubTabUpdate,
    SubTabProductResponse, SubTabProductCreate, SubTabProductUpdate
)

router = APIRouter()


# Роуты для вкладок
@router.get("/", response_model=List[TabResponse])
async def get_tabs(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Получить список всех вкладок"""
    try:
        query = db.query(Tab)
        if active_only:
            query = query.filter(Tab.is_active == True)
        
        tabs = query.order_by(Tab.order_index, Tab.id).offset(skip).limit(limit).all()
        return tabs
    except Exception as e:
        logger.error(f"Ошибка получения вкладок: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения вкладок")


@router.post("/", response_model=TabResponse)
async def create_tab(tab: TabCreate, db: Session = Depends(get_db)):
    """Создать новую вкладку"""
    try:
        # Получаем максимальный order_index для размещения новой вкладки справа
        max_order = db.query(Tab).order_by(Tab.order_index.desc()).first()
        order_index = (max_order.order_index + 1) if max_order else 0
        
        db_tab = Tab(
            name=tab.name,
            order_index=order_index,
            is_active=tab.is_active
        )
        db.add(db_tab)
        db.commit()
        db.refresh(db_tab)
        
        logger.info(f"Создана вкладка: {db_tab.name} (ID: {db_tab.id})")
        return db_tab
    except Exception as e:
        logger.error(f"Ошибка создания вкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка создания вкладки")


@router.get("/{tab_id}", response_model=TabResponse)
async def get_tab(tab_id: int, db: Session = Depends(get_db)):
    """Получить вкладку по ID"""
    tab = db.query(Tab).filter(Tab.id == tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Вкладка не найдена")
    return tab


@router.put("/{tab_id}", response_model=TabResponse)
async def update_tab(tab_id: int, tab_update: TabUpdate, db: Session = Depends(get_db)):
    """Обновить вкладку"""
    try:
        db_tab = db.query(Tab).filter(Tab.id == tab_id).first()
        if not db_tab:
            raise HTTPException(status_code=404, detail="Вкладка не найдена")
        
        update_data = tab_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_tab, field, value)
        
        db.commit()
        db.refresh(db_tab)
        
        logger.info(f"Обновлена вкладка: {db_tab.name} (ID: {db_tab.id})")
        return db_tab
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка обновления вкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка обновления вкладки")


@router.delete("/{tab_id}")
async def delete_tab(tab_id: int, db: Session = Depends(get_db)):
    """Удалить вкладку"""
    try:
        db_tab = db.query(Tab).filter(Tab.id == tab_id).first()
        if not db_tab:
            raise HTTPException(status_code=404, detail="Вкладка не найдена")
        
        db.delete(db_tab)
        db.commit()
        
        logger.info(f"Удалена вкладка: {db_tab.name} (ID: {db_tab.id})")
        return {"message": "Вкладка удалена"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка удаления вкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления вкладки")


@router.post("/{tab_id}/reorder")
async def reorder_tabs(tab_id: int, reorder_data: TabReorder, db: Session = Depends(get_db)):
    """Изменить порядок вкладки"""
    try:
        db_tab = db.query(Tab).filter(Tab.id == tab_id).first()
        if not db_tab:
            raise HTTPException(status_code=404, detail="Вкладка не найдена")
        
        old_order = db_tab.order_index
        new_order = reorder_data.new_order
        
        # Сдвигаем другие вкладки
        if new_order > old_order:
            # Сдвигаем влево
            db.query(Tab).filter(
                Tab.order_index > old_order,
                Tab.order_index <= new_order,
                Tab.id != tab_id
            ).update({Tab.order_index: Tab.order_index - 1})
        else:
            # Сдвигаем вправо
            db.query(Tab).filter(
                Tab.order_index >= new_order,
                Tab.order_index < old_order,
                Tab.id != tab_id
            ).update({Tab.order_index: Tab.order_index + 1})
        
        db_tab.order_index = new_order
        db.commit()
        
        logger.info(f"Изменён порядок вкладки {db_tab.name}: {old_order} -> {new_order}")
        return {"message": "Порядок изменён"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка изменения порядка вкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка изменения порядка")


# Роуты для подвкладок
@router.get("/{tab_id}/subtabs", response_model=List[SubTabResponse])
async def get_subtabs(
    tab_id: int,
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Получить подвкладки для вкладки"""
    try:
        # Проверяем существование вкладки
        tab = db.query(Tab).filter(Tab.id == tab_id).first()
        if not tab:
            raise HTTPException(status_code=404, detail="Вкладка не найдена")
        
        query = db.query(SubTab).filter(SubTab.tab_id == tab_id)
        if active_only:
            query = query.filter(SubTab.is_active == True)
        
        subtabs = query.order_by(SubTab.order_index, SubTab.id).offset(skip).limit(limit).all()
        return subtabs
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения подвкладок: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения подвкладок")


@router.post("/{tab_id}/subtabs", response_model=SubTabResponse)
async def create_subtab(tab_id: int, subtab: SubTabCreate, db: Session = Depends(get_db)):
    """Создать подвкладку"""
    try:
        # Проверяем существование вкладки
        tab = db.query(Tab).filter(Tab.id == tab_id).first()
        if not tab:
            raise HTTPException(status_code=404, detail="Вкладка не найдена")
        
        # Получаем максимальный order_index для размещения новой подвкладки справа
        max_order = db.query(SubTab).filter(SubTab.tab_id == tab_id).order_by(SubTab.order_index.desc()).first()
        order_index = (max_order.order_index + 1) if max_order else 0
        
        db_subtab = SubTab(
            tab_id=tab_id,
            name=subtab.name,
            order_index=order_index,
            is_active=subtab.is_active
        )
        db.add(db_subtab)
        db.commit()
        db.refresh(db_subtab)
        
        logger.info(f"Создана подвкладка: {db_subtab.name} (ID: {db_subtab.id}) во вкладке {tab.name}")
        return db_subtab
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка создания подвкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка создания подвкладки")


@router.put("/subtabs/{subtab_id}", response_model=SubTabResponse)
async def update_subtab(subtab_id: int, subtab_update: SubTabUpdate, db: Session = Depends(get_db)):
    """Обновить подвкладку"""
    try:
        db_subtab = db.query(SubTab).filter(SubTab.id == subtab_id).first()
        if not db_subtab:
            raise HTTPException(status_code=404, detail="Подвкладка не найдена")
        
        update_data = subtab_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_subtab, field, value)
        
        db.commit()
        db.refresh(db_subtab)
        
        logger.info(f"Обновлена подвкладка: {db_subtab.name} (ID: {db_subtab.id})")
        return db_subtab
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка обновления подвкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка обновления подвкладки")


@router.get("/subtabs/{subtab_id}", response_model=SubTabResponse)
async def get_subtab(subtab_id: int, db: Session = Depends(get_db)):
    """Получить подвкладку по ID"""
    try:
        subtab = db.query(SubTab).filter(SubTab.id == subtab_id).first()
        if not subtab:
            raise HTTPException(status_code=404, detail="Подвкладка не найдена")
        
        # Загружаем товары для подвкладки
        products = db.query(SubTabProduct).filter(
            SubTabProduct.subtab_id == subtab_id,
            SubTabProduct.is_active == True
        ).order_by(SubTabProduct.order_index, SubTabProduct.id).all()
        
        # Добавляем товары к ответу
        subtab_dict = {
            "id": subtab.id,
            "tab_id": subtab.tab_id,
            "name": subtab.name,
            "order_index": subtab.order_index,
            "is_active": subtab.is_active,
            "created_at": subtab.created_at,
            "updated_at": subtab.updated_at,
            "products": products
        }
        
        return subtab_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения подвкладки: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения подвкладки")


@router.delete("/subtabs/{subtab_id}")
async def delete_subtab(subtab_id: int, db: Session = Depends(get_db)):
    """Удалить подвкладку"""
    try:
        db_subtab = db.query(SubTab).filter(SubTab.id == subtab_id).first()
        if not db_subtab:
            raise HTTPException(status_code=404, detail="Подвкладка не найдена")
        
        db.delete(db_subtab)
        db.commit()
        
        logger.info(f"Удалена подвкладка: {db_subtab.name} (ID: {db_subtab.id})")
        return {"message": "Подвкладка удалена"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка удаления подвкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления подвкладки")


# Роуты для товаров в подвкладках
@router.get("/subtabs/{subtab_id}/products", response_model=List[SubTabProductResponse])
async def get_subtab_products(
    subtab_id: int,
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Получить товары подвкладки"""
    try:
        # Проверяем существование подвкладки
        subtab = db.query(SubTab).filter(SubTab.id == subtab_id).first()
        if not subtab:
            raise HTTPException(status_code=404, detail="Подвкладка не найдена")
        
        query = db.query(SubTabProduct).filter(SubTabProduct.subtab_id == subtab_id)
        if active_only:
            query = query.filter(SubTabProduct.is_active == True)
        
        products = query.order_by(SubTabProduct.order_index, SubTabProduct.id).offset(skip).limit(limit).all()
        return products
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения товаров подвкладки: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения товаров")


@router.post("/subtabs/{subtab_id}/products", response_model=List[SubTabProductResponse])
async def add_products_to_subtab(subtab_id: int, request: dict, db: Session = Depends(get_db)):
    """Добавить товары в подвкладку"""
    try:
        # Проверяем существование подвкладки
        subtab = db.query(SubTab).filter(SubTab.id == subtab_id).first()
        if not subtab:
            raise HTTPException(status_code=404, detail="Подвкладка не найдена")
        
        # Получаем список ID товаров из запроса
        product_remonline_ids = request.get('product_remonline_ids', [])
        if not product_remonline_ids or not isinstance(product_remonline_ids, list):
            raise HTTPException(status_code=400, detail="Требуется массив product_remonline_ids")
        
        # Получаем максимальный order_index
        max_order = db.query(SubTabProduct).filter(SubTabProduct.subtab_id == subtab_id).order_by(SubTabProduct.order_index.desc()).first()
        order_index = (max_order.order_index + 1) if max_order else 0
        
        added_products = []
        
        for product_id in product_remonline_ids:
            # Проверяем, не добавлен ли уже этот товар
            existing = db.query(SubTabProduct).filter(
                SubTabProduct.subtab_id == subtab_id,
                SubTabProduct.product_remonline_id == product_id
            ).first()
            
            if existing:
                logger.warning(f"Товар {product_id} уже добавлен в подвкладку {subtab.name}")
                continue
            
            db_product = SubTabProduct(
                subtab_id=subtab_id,
                product_remonline_id=product_id,
                custom_name=None,
                custom_category=None,
                order_index=order_index,
                is_active=True
            )
            db.add(db_product)
            added_products.append(db_product)
            order_index += 1
        
        if added_products:
            db.commit()
            # Обновляем данные после коммита
            for product in added_products:
                db.refresh(product)
        
        logger.info(f"Добавлено {len(added_products)} товаров в подвкладку {subtab.name}")
        return added_products
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка добавления товаров в подвкладку: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка добавления товаров")


@router.post("/subtabs/{subtab_id}/products/single", response_model=SubTabProductResponse)
async def add_single_product_to_subtab(subtab_id: int, product: SubTabProductCreate, db: Session = Depends(get_db)):
    """Добавить один товар в подвкладку"""
    try:
        # Проверяем существование подвкладки
        subtab = db.query(SubTab).filter(SubTab.id == subtab_id).first()
        if not subtab:
            raise HTTPException(status_code=404, detail="Подвкладка не найдена")
        
        # Проверяем, не добавлен ли уже этот товар
        existing = db.query(SubTabProduct).filter(
            SubTabProduct.subtab_id == subtab_id,
            SubTabProduct.product_remonline_id == product.product_remonline_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Товар уже добавлен в эту подвкладку")
        
        # Получаем максимальный order_index
        max_order = db.query(SubTabProduct).filter(SubTabProduct.subtab_id == subtab_id).order_by(SubTabProduct.order_index.desc()).first()
        order_index = (max_order.order_index + 1) if max_order else 0
        
        db_product = SubTabProduct(
            subtab_id=subtab_id,
            product_remonline_id=product.product_remonline_id,
            custom_name=product.custom_name,
            custom_category=product.custom_category,
            order_index=order_index,
            is_active=product.is_active
        )
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        
        logger.info(f"Добавлен товар {product.product_remonline_id} в подвкладку {subtab.name}")
        return db_product
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка добавления товара в подвкладку: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка добавления товара")


@router.put("/subtabs/products/{product_id}", response_model=SubTabProductResponse)
async def update_subtab_product(product_id: int, product_update: SubTabProductUpdate, db: Session = Depends(get_db)):
    """Обновить товар в подвкладке"""
    try:
        db_product = db.query(SubTabProduct).filter(SubTabProduct.id == product_id).first()
        if not db_product:
            raise HTTPException(status_code=404, detail="Товар в подвкладке не найден")
        
        update_data = product_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_product, field, value)
        
        db.commit()
        db.refresh(db_product)
        
        logger.info(f"Обновлён товар в подвкладке (ID: {db_product.id})")
        return db_product
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка обновления товара в подвкладке: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка обновления товара")


@router.delete("/subtabs/{subtab_id}/products/{product_remonline_id}")
async def remove_product_from_subtab(subtab_id: int, product_remonline_id: int, db: Session = Depends(get_db)):
    """Удалить товар из подвкладки по Remonline ID"""
    try:
        db_product = db.query(SubTabProduct).filter(
            SubTabProduct.subtab_id == subtab_id,
            SubTabProduct.product_remonline_id == product_remonline_id
        ).first()
        
        if not db_product:
            raise HTTPException(status_code=404, detail="Товар в подвкладке не найден")
        
        db.delete(db_product)
        db.commit()
        
        logger.info(f"Удалён товар {product_remonline_id} из подвкладки {subtab_id}")
        return {"message": "Товар удалён из подвкладки"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка удаления товара из подвкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления товара")


@router.delete("/subtabs/products/{product_id}")
async def remove_product_from_subtab_by_id(product_id: int, db: Session = Depends(get_db)):
    """Удалить товар из подвкладки по ID записи (для обратной совместимости)"""
    try:
        db_product = db.query(SubTabProduct).filter(SubTabProduct.id == product_id).first()
        if not db_product:
            raise HTTPException(status_code=404, detail="Товар в подвкладке не найден")
        
        db.delete(db_product)
        db.commit()
        
        logger.info(f"Удалён товар из подвкладки (ID: {db_product.id})")
        return {"message": "Товар удалён из подвкладки"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка удаления товара из подвкладки: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления товара")
