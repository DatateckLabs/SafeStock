from sqlalchemy import Column, DateTime, Float, Integer, String, Text, func
from app.db.base import Base


class EstoqueMinimo(Base):
    __tablename__ = "estoques_minimos"

    id             = Column(Integer, primary_key=True, index=True)
    cpd            = Column(String(50), unique=True, nullable=False, index=True)
    estoque_minimo = Column(Float, nullable=False, default=0.0)
    estoque_maximo = Column(Float, nullable=False, default=0.0)
    observacao     = Column(Text, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
