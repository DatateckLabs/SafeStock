// Contrato idêntico ao auth central Datateck
export interface MeResponse {
  username: string;
  role: string;
  groups: string[];
  permissions: string[];
  apps: string[];
}

export interface InsumoResponse {
  cpd: string;
  descricao: string | null;
  codigo_fabricante: string | null;
  subgrupo: string | null;
  estoque_almoxarifado: number;
  estoque_minimo: number;   // 0 = sem cadastro
  estoque_maximo: number;
  ocs_abertas: number;
  situacao: "ok" | "alerta" | "critico";
  moq: number;
  mpq: number;
  leadtime_semanas: number;
  unidade: string | null;
  razao_social_fornecedor: string | null;
  quantidade_pendente_oc: number;
}

export interface DrilldownItem {
  cpd_materia_prima: string;
  descricao: string | null;
  codigo_fabricante: string | null;
  ops_pendentes: number;
  produzido_raw: number;
  janela_meses: number;
  consumo_mensal_ferramenta: number;
  consumo_historico_mensal: number;
  consumo_pendente_mensal: number;
}

export interface FerramentaResponse {
  cpd_ferramenta: string;
  descricao: string | null;
  codigo_fabricante: string | null;
  consumo_mensal: number;
  consumo_historico_mensal: number;
  consumo_pendente_mensal: number;
  janela_meses: number;
  janela_dias: number;
  produzido_total: number;
  pendente_total: number;
  consumo_total: number;
  estoque_atual: number;
  estoque_minimo_calculado: number;
  ocs_abertas: number;
  situacao: "ok" | "alerta" | "critico";
  criticidade: "alta" | "media" | "baixa";
  moq: number;
  leadtime_semanas: number;
  leadtime_meses_calc: number;
  cobertura_meses: number;
  usa_cobertura_padrao: boolean;
  aplicacoes: number;
  consumo_ferramenta_mensal: number;
  num_terminais: number;
  razao_social_fornecedor: string | null;
  unidade: string | null;
}

export interface SemFerramentaItem {
  cpd_materia_prima:        string;
  codigo_fabricante:        string | null;
  subgrupo:                 string | null;
  consumo_mensal:           number;
  consumo_historico_mensal: number;
  consumo_pendente_mensal:  number;
  produzido_total:          number;
  pendente_total:           number;
  janela_meses:             number;
}

export interface ConsumoMensalItem {
  mes_ano: string;
  produzido: number;
  pendente: number;
}

export interface AlertaItem {
  cpd: string;
  descricao: string | null;
  tipo: "insumo" | "ferramenta";
  situacao: "alerta" | "critico";
  estoque_atual: number;
  estoque_minimo: number;
}

export interface DashboardStats {
  insumos_abaixo_minimo: number;
  ferramentas_criticas: number;
  ocs_geradas_hoje: number;
  alertas: AlertaItem[];
}

export interface PreviewItemOC {
  cpd: string;
  codigo_fabricante: string | null;
  descricao: string | null;
  qtd_sugerida: number;
  moq: number;
  unidade: string | null;
  leadtime_semanas: number;
  data_entrega: string;
  data_entrega_ajustada: boolean;
  sem_leadtime: boolean;
  estoque_atual: number;
  estoque_minimo: number;
  ocs_abertas: number;
}

export interface PreviewFornecedorOC {
  razao_social: string;
  id_fornecedor: number | null;
  itens: PreviewItemOC[];
}

export interface PreviewOCResponse {
  fornecedores: PreviewFornecedorOC[];
  total_fornecedores: number;
  total_itens: number;
}

export interface ItemOrdemCompra {
  id: number;
  cpd: string;
  descricao_item: string | null;
  qtd_solicitada: number;
  unidade: string | null;
  razao_social_fornecedor: string | null;
  estoque_atual: number | null;
  estoque_minimo_calculado: number | null;
}

export interface OrdemCompraGerada {
  id: number;
  numero_oc_interno: string;
  tipo: string;
  status: "gerada" | "enviada" | "erro";
  arquivo_path: string | null;
  email_destinatario: string | null;
  erro_msg: string | null;
  gerado_por_username: string;
  created_at: string;
  enviado_at: string | null;
  itens: ItemOrdemCompra[];
}

export interface GerarOCResponse {
  ordens: OrdemCompraGerada[];
  total_itens: number;
  mensagem: string;
}

export interface ParametroGlobal {
  id: number;
  chave: string;
  valor: string;
  descricao: string | null;
  updated_at: string;
}

export interface EstoqueMinimo {
  id: number;
  cpd: string;
  estoque_minimo: number;
  estoque_maximo: number;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigFornecedor {
  id: number;
  razao_social: string;
  leadtime_meses: number;
  cobertura_meses: number;
  created_at: string;
  updated_at: string;
}

export interface ConfigFerramenta {
  id: number;
  cpd_ferramenta: string;
  aplicacoes: number;
  leadtime_override: number | null;
  created_at: string;
  updated_at: string;
}

export interface CriticidadeFerramenta {
  id: number;
  cpd_ferramenta: string;
  criticidade: "alta" | "media" | "baixa";
  janela_consumo_dias: number | null;
  threshold_inatividade: number | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: number;
  username: string;
  role: "admin" | "gestor" | "operador";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DisparoLog {
  id: number;
  tipo: "manual" | "agendado";
  status: "ok" | "erro";
  email_operacional: string | null;
  email_gestor: string | null;
  total_fornecedores: number;
  total_itens: number;
  valor_total_brl: number | null;
  cotacao_usd_brl: number | null;
  arquivo_nome: string | null;
  erro_msg: string | null;
  created_at: string;
}

export interface DisparoResult {
  log: DisparoLog;
  mensagem: string;
}
