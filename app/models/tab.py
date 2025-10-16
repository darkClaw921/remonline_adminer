from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Tab(Base):
    """Модель вкладки"""
    __tablename__ = "tabs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    order_index = Column(Integer, default=0, index=True)
    is_active = Column(Boolean, default=True, index=True)
    main_tab_type = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связь с подвкладками
    subtabs = relationship("SubTab", back_populates="tab", cascade="all, delete-orphan")
    
    # Составной индекс для фильтрации и сортировки
    __table_args__ = (
        Index('idx_tab_main_type_active_order', 'main_tab_type', 'is_active', 'order_index'),
    )


class SubTab(Base):
    """Модель подвкладки"""
    __tablename__ = "subtabs"
    
    id = Column(Integer, primary_key=True, index=True)
    tab_id = Column(Integer, ForeignKey("tabs.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    order_index = Column(Integer, default=0, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи
    tab = relationship("Tab", back_populates="subtabs")
    products = relationship("SubTabProduct", back_populates="subtab", cascade="all, delete-orphan")
    
    # Составной индекс для фильтрации и сортировки
    __table_args__ = (
        Index('idx_subtab_tab_active_order', 'tab_id', 'is_active', 'order_index'),
    )


class SubTabProduct(Base):
    """Модель товара в подвкладке с возможностью переименования"""
    __tablename__ = "subtab_products"
    
    id = Column(Integer, primary_key=True, index=True)
    subtab_id = Column(Integer, ForeignKey("subtabs.id"), nullable=False, index=True)
    product_remonline_id = Column(Integer, nullable=False, index=True)
    custom_name = Column(String)
    custom_category = Column(String)
    order_index = Column(Integer, default=0, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связь с подвкладкой
    subtab = relationship("SubTab", back_populates="products")
    
    # Составные индексы для оптимизации запросов
    __table_args__ = (
        Index('idx_subtab_product_subtab_active_order', 'subtab_id', 'is_active', 'order_index'),
        Index('idx_subtab_product_unique', 'subtab_id', 'product_remonline_id', unique=True),
    )
