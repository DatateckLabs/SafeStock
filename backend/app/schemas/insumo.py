from pydantic import BaseModel


class InsumoResponse(BaseModel):
    cpd: str
    descricao: str | None
    subgrupo: str | None
    estoque_almoxarifado: float
    estoque_minimo: float       # 0.0 = sem cadastro em EstoqueMinimo
    estoque_maximo: float
    ocs_abertas: float
    situacao: str               # ok | alerta | critico
    moq: float
    mpq: float
    leadtime_semanas: float
    unidade: str | None
    razao_social_fornecedor: str | None
    quantidade_pendente_oc: float
