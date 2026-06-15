from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from app.db.base import Base


class User(Base):
    __tablename__ = "auth_users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(100), unique=True, nullable=False, index=True)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active       = Column(Boolean, default=True, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
