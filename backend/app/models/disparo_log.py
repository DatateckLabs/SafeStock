from sqlalchemy import Column, Integer, String, Float, DateTime, func
from app.db.base import Base


class DisparoLog(Base):
    __tablename__ = "disparos_log"

    id                = Column(Integer, primary_key=True, index=True)
    tipo              = Column(String(20),  nullable=False, default="manual")   # manual | agendado
    status            = Column(String(10),  nullable=False)                     # ok | erro
    email_operacional = Column(String(255), nullable=True)
    email_gestor      = Column(String(255), nullable=True)
    total_fornecedores = Column(Integer,   nullable=False, default=0)
    total_itens       = Column(Integer,    nullable=False, default=0)
    valor_total_brl   = Column(Float,      nullable=True)
    cotacao_usd_brl   = Column(Float,      nullable=True)
    arquivo_nome      = Column(String(255), nullable=True)
    erro_msg          = Column(String,     nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
