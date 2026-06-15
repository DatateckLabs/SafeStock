from sqlalchemy import Column, DateTime, Float, Integer, String, func
from app.db.base import Base


class ConfigFerramenta(Base):
    __tablename__ = "config_ferramentas"

    id                = Column(Integer, primary_key=True, index=True)
    cpd_ferramenta    = Column(String(50), unique=True, nullable=False, index=True)
    aplicacoes        = Column(Integer, nullable=False, default=80_000)
    leadtime_override = Column(Float, nullable=True)   # null = herda do fornecedor
    created_at        = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
