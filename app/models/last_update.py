from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base

class LastUpdate(Base):
    __tablename__ = "last_updates"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)  # 'warehouses', 'products', 'stocks'
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    status = Column(String, default="success")  # 'success', 'error', 'in_progress'
    error_message = Column(String)
