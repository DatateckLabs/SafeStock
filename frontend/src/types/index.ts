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
  ops_pendentes: number;
  consumo_mensal_ferramenta: number;
}

export interface FerramentaResponse {
  cpd_ferramenta: string;
  descricao: string | null;
  consumo_mensal: number;
  consumo_total: number;
  estoque_atual: number;
  estoque_minimo_calculado: number;
  ocs_abertas: number;
  situacao: "ok" | "alerta" | "critico";
  criticidade: "alta" | "media" | "baixa";
  moq: number;
  leadtime_semanas: number;
  razao_social_fornecedor: string | null;
  unidade: string | null;
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
