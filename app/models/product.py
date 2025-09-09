from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    remonline_id = Column(Integer, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    sku = Column(String, index=True)
    barcode = Column(String, index=True)
    description = Column(Text)
    price = Column(Float)
    category = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Связь с остатками товаров
    stocks = relationship("Stock", back_populates="product")

    # Дополнительные поля из Remonline
    code = Column(String)
    uom_json = Column(JSON)
    images_json = Column(JSON)
    prices_json = Column(JSON)
    category_json = Column(JSON)
    custom_fields_json = Column(JSON)
    barcodes_json = Column(JSON)
    is_serial = Column(Boolean, default=False)
    warranty = Column(Integer)
    warranty_period = Column(Integer)
