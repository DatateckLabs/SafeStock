from sqlalchemy import Column, DateTime, Integer, String, Text, func
from app.db.base import Base


class ParametroGlobal(Base):
    __tablename__ = "parametros_globais"

    id        = Column(Integer, primary_key=True, index=True)
    chave     = Column(String(100), unique=True, nullable=False, index=True)
    valor     = Column(Text, nullable=False, default="")
    descricao = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
