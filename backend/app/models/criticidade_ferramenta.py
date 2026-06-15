from sqlalchemy import Column, DateTime, Float, Integer, String, Text, func
from app.db.base import Base


class CriticidadeFerramenta(Base):
    __tablename__ = "criticidades_ferramentas"

    id                   = Column(Integer, primary_key=True, index=True)
    cpd_ferramenta       = Column(String(50), unique=True, nullable=False, index=True)
    criticidade          = Column(String(10), nullable=False, default="media")
    janela_consumo_dias  = Column(Integer, nullable=True)
    threshold_inatividade = Column(Float, nullable=True)
    observacao           = Column(Text, nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
