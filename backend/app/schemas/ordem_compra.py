from datetime import datetime
from pydantic import BaseModel


class PreviewItemOC(BaseModel):
    cpd: str
    codigo_fabricante: str | None
    descricao: str | None
    qtd_sugerida: float
    moq: float
    unidade: str | None
    leadtime_semanas: float
    data_entrega: str            # ISO date "YYYY-MM-DD" (pode ser consolidada)
    data_entrega_ajustada: bool = False  # True quando a data foi consolidada com outros itens
    sem_leadtime: bool = False           # True quando leadtime=0 (usando fallback 30 dias)
    estoque_atual: float
    estoque_minimo: float
    ocs_abertas: float


class PreviewFornecedorOC(BaseModel):
    razao_social: str
    id_fornecedor: int | None
    itens: list[PreviewItemOC]


class PreviewOCResponse(BaseModel):
    fornecedores: list[PreviewFornecedorOC]
    total_fornecedores: int
    total_itens: int


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
