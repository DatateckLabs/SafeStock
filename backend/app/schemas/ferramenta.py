from pydantic import BaseModel


class FerramentaResponse(BaseModel):
    cpd_ferramenta: str
    descricao: str | None
    codigo_fabricante: str | None
    consumo_mensal: float
    consumo_historico_mensal: float
    consumo_pendente_mensal: float
    janela_meses: float
    janela_dias: int
    produzido_total: float
    pendente_total: float
    consumo_total: float
    estoque_atual: float
    estoque_minimo_calculado: float
    ocs_abertas: float
    situacao: str
    criticidade: str
    moq: float
    leadtime_semanas: float          # do MRP/BQ, em semanas (para exibição e OC)
    leadtime_meses_calc: float       # leadtime em meses usado no cálculo do estoque_mínimo
    cobertura_meses: float           # cobertura de segurança em meses
    usa_cobertura_padrao: bool       # True quando usa o parâmetro global cobertura_meses_padrao
    aplicacoes: float                # durabilidade da ferramenta (terminais por unidade)
    consumo_ferramenta_mensal: float # consumo_mensal / aplicacoes = unidades de ferramenta/mês
    num_terminais: int               # quantos CPDs de terminal usam esta ferramenta
    razao_social_fornecedor: str | None
    unidade: str | None
    data_ultimo_inventario: str | None = None
    preco_compra: float = 0.0
    moeda: str | None = None


class SemFerramentaItem(BaseModel):
    cpd_materia_prima:        str
    codigo_fabricante:        str | None
    descricao:                str | None
    subgrupo:                 str | None
    consumo_mensal:           float
    consumo_historico_mensal: float
    consumo_pendente_mensal:  float
    produzido_total:          float
    pendente_total:           float
    janela_meses:             float


class ConsumoMensalItem(BaseModel):
    mes_ano: str
    produzido: float
    pendente: float


class DrilldownItem(BaseModel):
    cpd_materia_prima: str
    descricao: str | None
    codigo_fabricante: str | None
    ops_pendentes: float
    produzido_raw: float
    janela_meses: float
    consumo_mensal_ferramenta: float
    consumo_historico_mensal: float
    consumo_pendente_mensal: float
