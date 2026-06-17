from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from app.db.base import Base


class DisparoItemLog(Base):
    __tablename__ = "disparos_item_log"

    id                      = Column(Integer, primary_key=True, autoincrement=True)
    disparo_log_id          = Column(Integer, ForeignKey("disparos_log.id"), nullable=False, index=True)
    modulo                  = Column(String(20),  nullable=False)   # insumos | ferramentas
    cpd                     = Column(String(50),  nullable=False)
    descricao               = Column(String(500), nullable=True)
    razao_social_fornecedor = Column(String(200), nullable=True)
    qtd_sugerida            = Column(Float, nullable=False, default=0.0)
    preco_unitario          = Column(Float, default=0.0)
    moeda                   = Column(String(10),  default="BRL")
    valor_brl               = Column(Float, default=0.0)
    ocs_abertas             = Column(Float, default=0.0)
    estoque_atual           = Column(Float, nullable=True)
    created_at              = Column(DateTime(timezone=True), server_default=func.now())
