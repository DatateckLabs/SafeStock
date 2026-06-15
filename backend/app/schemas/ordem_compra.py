from datetime import datetime
from pydantic import BaseModel


class ItemOrdemCompraResponse(BaseModel):
    id: int
    cpd: str
    descricao_item: str | None
    qtd_solicitada: float
    unidade: str | None
    razao_social_fornecedor: str | None
    estoque_atual: float | None
    estoque_minimo_calculado: float | None

    model_config = {"from_attributes": True}


class OrdemCompraGeradaResponse(BaseModel):
    id: int
    numero_oc_interno: str
    tipo: str
    status: str
    arquivo_path: str | None
    email_destinatario: str | None
    erro_msg: str | None
    gerado_por_username: str
    created_at: datetime
    enviado_at: datetime | None
    itens: list[ItemOrdemCompraResponse] = []

    model_config = {"from_attributes": True}


class GerarOCResponse(BaseModel):
    ordens: list[OrdemCompraGeradaResponse]
    total_itens: int
    mensagem: str
