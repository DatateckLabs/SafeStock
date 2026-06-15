from pydantic import BaseModel


class FerramentaResponse(BaseModel):
    cpd_ferramenta: str
    descricao: str | None
    consumo_mensal: float
    consumo_total: float
    estoque_atual: float
    estoque_minimo_calculado: float
    ocs_abertas: float
    situacao: str
    criticidade: str
    moq: float
    leadtime_semanas: float
    razao_social_fornecedor: str | None
    unidade: str | None


class DrilldownItem(BaseModel):
    cpd_materia_prima: str
    descricao: str | None
    ops_pendentes: float
    consumo_mensal_ferramenta: float
