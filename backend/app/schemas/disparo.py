from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DisparoLogResponse(BaseModel):
    id: int
    tipo: str
    modulo: str
    status: str
    email_operacional: Optional[str]
    email_gestor: Optional[str]
    total_fornecedores: int
    total_itens: int
    valor_total_brl: Optional[float]
    cotacao_usd_brl: Optional[float]
    arquivo_nome: Optional[str]
    erro_msg: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class DisparoResult(BaseModel):
    log: DisparoLogResponse
    mensagem: str
