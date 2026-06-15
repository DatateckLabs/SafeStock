from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class OrdemCompraGerada(Base):
    __tablename__ = "ordens_compra_geradas"

    id                  = Column(Integer, primary_key=True, index=True)
    numero_oc_interno   = Column(String(50), unique=True, nullable=False, index=True)
    tipo                = Column(String(20), nullable=False)   # insumo | ferramenta
    status              = Column(String(20), nullable=False, default="gerada")  # gerada | enviada | erro
    arquivo_path        = Column(Text, nullable=True)
    email_destinatario  = Column(Text, nullable=True)
    erro_msg            = Column(Text, nullable=True)
    gerado_por_username = Column(String(100), nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    enviado_at          = Column(DateTime(timezone=True), nullable=True)

    itens = relationship("ItemOrdemCompraGerada", back_populates="ordem_compra", cascade="all, delete-orphan")


class ItemOrdemCompraGerada(Base):
    __tablename__ = "itens_ordens_compra_geradas"

    id                       = Column(Integer, primary_key=True, index=True)
    ordem_compra_id          = Column(Integer, ForeignKey("ordens_compra_geradas.id"), nullable=False)
    cpd                      = Column(String(50), nullable=False)
    descricao_item           = Column(Text, nullable=True)
    qtd_solicitada           = Column(Float, nullable=False)
    unidade                  = Column(String(20), nullable=True)
    razao_social_fornecedor  = Column(Text, nullable=True)
    estoque_atual            = Column(Float, nullable=True)
    estoque_minimo_calculado = Column(Float, nullable=True)

    ordem_compra = relationship("OrdemCompraGerada", back_populates="itens")
