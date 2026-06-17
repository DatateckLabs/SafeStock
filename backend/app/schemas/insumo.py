from pydantic import BaseModel


class InsumoResponse(BaseModel):
    cpd: str
    descricao: str | None
    codigo_fabricante: str | None
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
    consumo_mensal: float = 0.0
    consumo_historico_mensal: float = 0.0
    consumo_pendente_mensal: float = 0.0
    mrp_auto: str | None = None
    data_ultimo_inventario: str | None = None
    preco_compra: float = 0.0
    moeda: str | None = None


class InsumoChicoteItem(BaseModel):
    descricao_produto: str | None
    cliente: str | None
    consumo_mensal: float
    consumo_historico_mensal: float
    consumo_pendente_mensal: float
    meses_total: int
