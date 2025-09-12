from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Tab(Base):
    """Модель вкладки"""
    __tablename__ = "tabs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    order_index = Column(Integer, default=0)  # Порядок отображения
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связь с подвкладками
    subtabs = relationship("SubTab", back_populates="tab", cascade="all, delete-orphan")


class SubTab(Base):
    """Модель подвкладки"""
    __tablename__ = "subtabs"
    
    id = Column(Integer, primary_key=True, index=True)
    tab_id = Column(Integer, ForeignKey("tabs.id"), nullable=False)
    name = Column(String, nullable=False)
    order_index = Column(Integer, default=0)  # Порядок отображения внутри вкладки
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи
    tab = relationship("Tab", back_populates="subtabs")
    products = relationship("SubTabProduct", back_populates="subtab", cascade="all, delete-orphan")


class SubTabProduct(Base):
    """Модель товара в подвкладке с возможностью переименования"""
    __tablename__ = "subtab_products"
    
    id = Column(Integer, primary_key=True, index=True)
    subtab_id = Column(Integer, ForeignKey("subtabs.id"), nullable=False)
    product_remonline_id = Column(Integer, nullable=False)  # ID товара в Remonline
    custom_name = Column(String)  # Переименованное название (опционально)
    custom_category = Column(String)  # Переименованная категория (опционально)
    order_index = Column(Integer, default=0)  # Порядок отображения в подвкладке
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связь с подвкладкой
    subtab = relationship("SubTab", back_populates="products")
