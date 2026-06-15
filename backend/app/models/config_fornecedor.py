from sqlalchemy import Column, DateTime, Float, Integer, String, func
from app.db.base import Base


class ConfigFornecedor(Base):
    __tablename__ = "config_fornecedores"

    id              = Column(Integer, primary_key=True, index=True)
    razao_social    = Column(String(255), unique=True, nullable=False, index=True)
    leadtime_meses  = Column(Float, nullable=False, default=2.0)
    cobertura_meses = Column(Float, nullable=False, default=2.0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
