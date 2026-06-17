import { Modal } from "./Modal";

const SECOES = [
  {
    titulo: "O que é o SafeStock",
    cor: "var(--accent)",
    itens: [
      "Sistema de monitoramento de estoque integrado ao ERP Delphus via BigQuery.",
      "Os dados são lidos em tempo real a cada acesso à tela — não há botão de sincronizar.",
      "Cobre dois módulos: Insumos (etiquetas, ribbons e tudo que for alinhado para ser comprado conforme estoque mínimo do Delphus) e Ferramentas (grampos, facas e tudo que estiver na tabela ToolGuard com cadastro de ferramenta/terminal).",
    ],
    obs: "",
  },
  {
    titulo: "Como o monitoramento funciona",
    cor: "var(--success)",
    itens: [
      "Cada item tem um estoque mínimo configurado no Delphus.",
      "O SafeStock compara o estoque atual com esse mínimo e sinaliza quem precisa de reposição.",
      "OCs já em aberto no ERP são somadas ao estoque atual — evitando compras desnecessárias.",
      "Itens sem estoque mínimo configurado ficam invisíveis para os alertas.",
    ],
    obs: "Regra: saldo = estoque almoxarifado + OCs abertas − estoque mínimo. Saldo negativo = compra necessária.",
  },
  {
    titulo: "Significado dos status",
    cor: "var(--warning)",
    itens: [
      "Verde ✔ — estoque OK, acima do mínimo.",
      "Amarelo ▲ — alerta: abaixo do mínimo, mas ainda tem algum estoque.",
      "Vermelho ✖ — crítico: estoque zerado.",
      "Cinza — sem estoque mínimo configurado; item não participa dos alertas.",
    ],
    obs: "",
  },
  {
    titulo: "Pedidos de Compra (OC)",
    cor: "var(--accent)",
    itens: [
      "O SafeStock agrupa automaticamente os itens que precisam de reposição por fornecedor.",
      "A quantidade sugerida respeita o MOQ (quantidade mínima de compra) de cada item.",
      "O Excel gerado segue o padrão de importação do ERP Delphus — basta importar.",
      "Itens com CPD inválido ou fornecedor sem ID no ERP são bloqueados do Excel automaticamente.",
    ],
    obs: "O arquivo Excel é salvo localmente em /disparos e enviado por e-mail junto com o dashboard.",
  },
  {
    titulo: "Disparo de E-mail",
    cor: "#6366f1",
    itens: [
      "Pode ser acionado manualmente ou de forma agendada (conforme configuração).",
      "Envia o mesmo e-mail para o operador ERP e para o gestor.",
      "Anexo: Excel pronto para importação no ERP (apenas itens válidos).",
      "Dashboard HTML: Pareto de valores do lote, itens recorrentes sem OC e seção de pendências.",
    ],
    obs: "O Pareto mostra quais fornecedores concentram 80% do valor do lote atual — útil para priorizar negociações.",
  },
  {
    titulo: "Cadastros Pendentes / Ferramentas Pendentes",
    cor: "var(--danger)",
    itens: [
      "Itens que ainda não têm estoque mínimo configurado no Delphus.",
      "Enquanto não configurados, não geram alerta e não entram nas OCs automáticas.",
      "A configuração deve ser feita no Delphus — o SafeStock apenas lê os dados.",
      "Itens com consumo mensal = 0 são exibidos, mas não contam no badge de alerta.",
    ],
    obs: "Itens comprados por MRP automático (MRP_AUTO = S) ficam fora dos alertas — o próprio ERP cuida deles.",
  },
  {
    titulo: "Pendências que bloqueiam o Excel",
    cor: "#d97706",
    itens: [
      "CPD não numérico (ex: 'NÃO TEM CPD'): item bloqueado do Excel — ERP rejeitaria a linha.",
      "Fornecedor sem ID no ERP ('SEM FORNECEDOR'): bloqueado — OC sem fornecedor é inválida.",
      "Itens sem preço cadastrado: alertados no dashboard, mas não bloqueados do Excel.",
      "Todos os problemas aparecem na seção 'Pendências' do e-mail para o gestor corrigir.",
    ],
    obs: "Resolva as pendências no Delphus: cadastre o CPD correto, vincule o fornecedor e informe o preço.",
  },
  {
    titulo: "O que fazer onde",
    cor: "var(--muted)",
    itens: [
      "Delphus: configurar estoque mínimo, vincular fornecedor, cadastrar preço de compra e CPD de cada insumo.",
      "ToolGuard: cadastrar e manter as ferramentas (cabeçotes, facas, grampos) e seus terminais — o botão '⚙ Tool Guard ↗' na aba Ferramentas abre a aplicação.",
      "SafeStock: visualizar alertas, revisar o preview de OC e acionar o disparo de e-mail.",
      "Após o disparo: importar o Excel no ERP e acompanhar as OCs abertas no módulo de compras.",
    ],
    obs: "Qualquer item sem cadastro no Delphus (insumo) ou no ToolGuard (ferramenta) não aparece no SafeStock.",
  },
];

const BTN_STYLE: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: "50%",
  width: 28,
  height: 28,
  cursor: "pointer",
  color: "var(--muted)",
  fontSize: "0.82rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  marginTop: 2,
};

export function SobreModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Como funciona o SafeStock" onClose={onClose}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxHeight: "70vh",
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {SECOES.map(s => (
          <div key={s.titulo} style={{ borderLeft: `3px solid ${s.cor}`, paddingLeft: 14 }}>
            <p style={{ fontWeight: 700, marginBottom: 8, color: s.cor, fontSize: "0.9rem" }}>
              {s.titulo}
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                color: "var(--text)",
                fontSize: "0.84rem",
                lineHeight: 1.75,
              }}
            >
              {s.itens.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            {s.obs && (
              <p
                style={{
                  marginTop: 6,
                  color: "var(--muted)",
                  fontSize: "0.78rem",
                  fontStyle: "italic",
                }}
              >
                {s.obs}
              </p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function SobreButton({ onClick }: { onClick: () => void }) {
  return (
    <button title="Como funciona esta ferramenta" onClick={onClick} style={BTN_STYLE}>
      ?
    </button>
  );
}
