from pydantic import BaseModel


class AlertaItem(BaseModel):
    cpd: str
    descricao: str | None
    tipo: str  # insumo | ferramenta
    situacao: str  # alerta | critico
    estoque_atual: float
    estoque_minimo: float


class DashboardStats(BaseModel):
    insumos_abaixo_minimo: int
    ferramentas_criticas: int
    ocs_geradas_hoje: int
    alertas: list[AlertaItem]
