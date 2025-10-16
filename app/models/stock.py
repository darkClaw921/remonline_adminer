from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False, default=0)
    reserved_quantity = Column(Float, default=0)
    available_quantity = Column(Float, nullable=False, default=0, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Связи
    warehouse = relationship("Warehouse", back_populates="stocks")
    product = relationship("Product", back_populates="stocks")
    
    # Составные индексы и ограничения для оптимизации запросов
    __table_args__ = (
        UniqueConstraint('warehouse_id', 'product_id', name='uq_stock_warehouse_product'),
        Index('idx_stock_warehouse_product', 'warehouse_id', 'product_id'),
        Index('idx_stock_product_quantity', 'product_id', 'available_quantity'),
    )
