from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from app.db.base import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(100), unique=True, nullable=False, index=True)
    role       = Column(String(20), nullable=False, default="operador")
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
