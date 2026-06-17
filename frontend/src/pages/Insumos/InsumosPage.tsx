import { useState, useEffect } from "react";
import { InsumosService } from "../../services/InsumosService";
import { OrdensCompraService } from "../../services/OrdensCompraService";
import { DisparoService } from "../../services/DisparoService";
import { Modal } from "../../components/Modal";
import { SobreModal, SobreButton } from "../../components/SobreModal";
import { OcPreviewTab } from "../../components/OcPreviewCard";
import { DisparoTab } from "../../components/DisparoTab";
import { useAuth } from "../../auth/useAuth";
import type { InsumoResponse, InsumoChicoteItem } from "../../types";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtData(d: string | null | undefined): string {
  if (!d) return "—";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
  return d.slice(0, 10);
}

function saldoInsumo(i: InsumoResponse): number | null {
  if (i.estoque_minimo <= 0) return null;
  return i.estoque_almoxarifado + i.ocs_abertas - i.estoque_minimo;
}

function compraSugerida(i: InsumoResponse): number | null {
  if (i.estoque_minimo <= 0) return null;
  const needed = Math.max(0, i.estoque_minimo - i.estoque_almoxarifado - i.ocs_abertas);
  if (needed === 0) return null;
  if (i.moq <= 0) return needed;
  return Math.ceil(needed / i.moq) * i.moq;
}

function sortBySaldoInsumo(items: InsumoResponse[]): InsumoResponse[] {
  return [...items].sort((a, b) => {
    const sa = saldoInsumo(a) ?? Infinity;
    const sb = saldoInsumo(b) ?? Infinity;
    return sa - sb;
  });
}

function SaldoCell({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "var(--muted)" }}>—</span>;
  if (value > 0)
    return <span style={{ color: "var(--success)", fontWeight: 600 }}>+{fmt(value)}</span>;
  if (value < 0)
    return <span style={{ color: "var(--danger)", fontWeight: 600 }}>−{fmt(Math.abs(value))}</span>;
  return <span style={{ color: "var(--muted)" }}>0,00</span>;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <span className="skel" style={{ width: i === 1 ? "75%" : "55%" }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Modal de regras ──────────────────────────────────────────────────────────

const REGRAS_INSUMOS = [
  {
    titulo: "Cadastro Pendente",
    cor: "var(--danger)",
    regras: [
      "Estoque mínimo = 0 ou não configurado",
      "MRP_AUTO ≠ 'S' (itens comprados por MRP automático são excluídos)",
      "Qualquer nível de estoque atual (inclusive zerado)",
    ],
    obs: "Esses itens não participam do alerta de reposição nem das OCs automáticas até serem configurados.",
  },
  {
    titulo: "Alerta de Reposição (Lista Geral)",
    cor: "var(--warning)",
    regras: [
      "Estoque mínimo > 0",
      "Estoque atual < Estoque mínimo → status 'alerta'",
      "Estoque atual = 0 → status 'crítico'",
    ],
    obs: "OCs em aberto são somadas ao estoque atual para cálculo do saldo.",
  },
  {
    titulo: "MRP Automático",
    cor: "var(--accent)",
    regras: [
      "MRP_AUTO = 'S' na tabela Parametros_MRP_sem_duplicidade",
      "Comprado conforme pedido via MRP — não requer estoque mínimo",
      "Excluído do Cadastro Pendente e dos alertas de reposição automática",
    ],
    obs: "Para ativar o controle por estoque mínimo nesse item, desative o MRP_AUTO no ERP.",
  },
  {
    titulo: "Itens incluídos no módulo",
    cor: "var(--success)",
    regras: [
      "Subgrupos configurados em Cadastros → Parâmetros (subgrupos_insumos)",
      "INATIVO ≠ 'S' na tabela MRP",
      "Padrão: ETIQUETAS EXTERNAS, ETIQUETAS E RIBBONS INTERNAS",
    ],
    obs: "",
  },
];

function RegrasModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Regras de Negócio — Insumos" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
        {REGRAS_INSUMOS.map(r => (
          <div key={r.titulo} style={{ borderLeft: `3px solid ${r.cor}`, paddingLeft: 14 }}>
            <p style={{ fontWeight: 700, marginBottom: 8, color: r.cor, fontSize: "0.9rem" }}>{r.titulo}</p>
            <ul style={{ margin: 0, paddingLeft: 16, color: "var(--text)", fontSize: "0.84rem", lineHeight: 1.7 }}>
              {r.regras.map((reg, i) => <li key={i}>{reg}</li>)}
            </ul>
            {r.obs && (
              <p style={{ marginTop: 6, color: "var(--muted)", fontSize: "0.78rem", fontStyle: "italic" }}>{r.obs}</p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Insumos lista ────────────────────────────────────────────────────────────

function InsumosListTab({
  items, loading, error, onReload,
}: {
  items: InsumoResponse[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch]     = useState("");
  const [editItem, setEditItem] = useState<InsumoResponse | null>(null);
  const [formMin, setFormMin]   = useState(0);
  const [formMax, setFormMax]   = useState(0);
  const [saving, setSaving]     = useState(false);

  const canEdit = user?.role === "admin" || user?.role === "gestor";

  function load() { onReload(); }

  function openEdit(item: InsumoResponse) {
    setEditItem(item);
    setFormMin(item.estoque_minimo);
    setFormMax(item.estoque_maximo);
  }

  async function salvar() {
    if (!editItem) return;
    setSaving(true);
    try {
      await InsumosService.updateEstoque(editItem.cpd, {
        estoque_minimo: formMin,
        estoque_maximo: formMax,
      });
      setEditItem(null);
      load();
    } catch {
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = sortBySaldoInsumo(
    items.filter(
      i =>
        i.cpd.toLowerCase().includes(search.toLowerCase()) ||
        (i.descricao || "").toLowerCase().includes(search.toLowerCase()) ||
        (i.codigo_fabricante || "").toLowerCase().includes(search.toLowerCase())
    )
  );

  const cols = canEdit ? 9 : 8;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input
          className="search-input"
          style={{ marginBottom: 0, flex: 1, maxWidth: 360 }}
          placeholder="Buscar por CPD ou descricao..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          {loading ? "…" : `${filtered.length} itens`}
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 72 }}>CPD</th>
              <th>Cód. Fabricante</th>
              <th style={{ textAlign: "right", width: 100 }}>Est. Mín.</th>
              <th style={{ textAlign: "right", width: 70 }}>OCs</th>
              <th style={{ textAlign: "right", width: 100 }}>Est. Atual</th>
              <th style={{ textAlign: "right", width: 80, whiteSpace: "nowrap" }}>Inventário</th>
              <th style={{ textAlign: "right", width: 100 }}>Saldo</th>
              <th style={{ textAlign: "right", width: 100 }}>Compra Sug.</th>
              <th style={{ textAlign: "right", width: 110 }}>Valor OC</th>
              {canEdit && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={cols} />)
              : filtered.map(item => {
                  const saldo = saldoInsumo(item);
                  return (
                    <tr key={item.cpd}>
                      <td>
                        <code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{item.cpd}</code>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.84rem", fontWeight: 500 }}
                                  title={item.codigo_fabricante || item.descricao || undefined}>
                              {item.codigo_fabricante || item.descricao || "—"}
                            </span>
                            {item.mrp_auto === "S" && (
                              <span title="Comprado por MRP automático — não requer estoque mínimo" style={{
                                flexShrink: 0, fontSize: "0.65rem", fontWeight: 700, padding: "1px 4px",
                                borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "var(--accent)",
                                border: "1px solid rgba(99,102,241,0.3)",
                              }}>MRP</span>
                            )}
                          </div>
                          {item.descricao && (
                            <div style={{ fontSize: "0.72rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                 title={item.descricao}>
                              {item.descricao}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", color: item.estoque_minimo > 0 ? "var(--text)" : "var(--muted)" }}>
                        {item.estoque_minimo > 0 ? fmt(item.estoque_minimo) : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: item.ocs_abertas > 0 ? "var(--accent)" : "var(--muted)" }}>
                        {fmt(item.ocs_abertas)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {fmt(item.estoque_almoxarifado)}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {fmtData(item.data_ultimo_inventario)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <SaldoCell value={saldo} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {(() => {
                          const cs = compraSugerida(item);
                          if (cs === null) return <span style={{ color: "var(--text-dim)" }}>—</span>;
                          return (
                            <span
                              style={{ color: "var(--warning)", fontWeight: 600 }}
                              title={item.moq > 0 ? `MOQ: ${fmt(item.moq)}` : undefined}
                            >
                              {fmt(cs)}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {(() => {
                          const cs = compraSugerida(item);
                          if (cs === null || item.preco_compra <= 0) return <span style={{ color: "var(--muted)" }}>—</span>;
                          const valor = cs * item.preco_compra;
                          const prefix = (item.moeda || "BRL").toUpperCase() === "USD" ? "US$" : "R$";
                          return (
                            <span style={{ color: "var(--text)", fontWeight: 600 }}>
                              <span style={{ color: "var(--muted)", fontWeight: 400, marginRight: 2, fontSize: "0.75rem" }}>{prefix}</span>
                              {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          );
                        })()}
                      </td>
                      {canEdit && (
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="expand-btn"
                            title="Editar minimo/maximo"
                            onClick={() => openEdit(item)}
                          >
                            ✎
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <p className="empty-state">Nenhum insumo encontrado.</p>
        )}
      </div>

      {editItem && (
        <Modal title={`Editar estoque — ${editItem.cpd}`} onClose={() => setEditItem(null)}>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 16 }}>
            {editItem.descricao}
          </p>
          <label className="form-label">Estoque minimo</label>
          <input
            className="form-input"
            type="number"
            step="0.01"
            value={formMin}
            onChange={e => setFormMin(parseFloat(e.target.value) || 0)}
          />
          <label className="form-label" style={{ marginTop: 12 }}>
            Estoque maximo
          </label>
          <input
            className="form-input"
            type="number"
            step="0.01"
            value={formMax}
            onChange={e => setFormMax(parseFloat(e.target.value) || 0)}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn-primary" onClick={salvar} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn-ghost" onClick={() => setEditItem(null)}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Cadastro Pendente tab ────────────────────────────────────────────────────

function ChicoteDrillRow({ cpd }: { cpd: string }) {
  const [rows, setRows]       = useState<InsumoChicoteItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    InsumosService.getDrilldown(cpd)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [cpd]);

  if (loading) {
    return (
      <tr><td colSpan={10} style={{ padding: "10px 20px", color: "var(--muted)", fontSize: "0.82rem" }}>
        Carregando drilldown...
      </td></tr>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <tr><td colSpan={10} style={{ padding: "10px 20px", color: "var(--muted)", fontSize: "0.82rem" }}>
        Nenhuma OP encontrada para este insumo.
      </td></tr>
    );
  }
  return (
    <>
      {rows.map((r, i) => (
        <tr key={i} style={{ background: "var(--surface2)", fontSize: "0.8rem" }}>
          <td style={{ paddingLeft: 40, color: "var(--muted)" }}>{i + 1}</td>
          <td colSpan={2} style={{ color: "var(--text)" }}>
            {r.descricao_produto || "—"}
          </td>
          <td style={{ color: "var(--muted)" }}>{r.cliente || "—"}</td>
          <td style={{ textAlign: "right", color: "var(--text)", fontWeight: 600 }}>
            {r.consumo_mensal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </td>
          <td style={{ textAlign: "right", color: "var(--muted)" }}>
            {r.consumo_historico_mensal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </td>
          <td style={{ textAlign: "right", color: r.consumo_pendente_mensal > 0 ? "var(--warning)" : "var(--muted)" }}>
            {r.consumo_pendente_mensal > 0 ? r.consumo_pendente_mensal.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—"}
          </td>
          <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.75rem" }}>
            {r.meses_total}m
          </td>
          <td />
        </tr>
      ))}
    </>
  );
}

function SemCadastroTab({
  items, loading,
}: {
  items: InsumoResponse[];
  loading: boolean;
}) {
  const [search, setSearch]         = useState("");
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());
  const [sortCol, setSortCol]       = useState<"cpd" | "descricao" | "subgrupo" | "estoque" | "ocs" | "consumo">("consumo");
  const [sortAsc, setSortAsc]       = useState(false);

  const semCadastro = items.filter(i => i.estoque_minimo <= 0 && i.mrp_auto !== "S");
  const semCadastroComConsumo = semCadastro.filter(i => i.consumo_mensal > 0).length;
  const mrpAutoCount = items.filter(i => i.estoque_minimo <= 0 && i.mrp_auto === "S").length;

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(v => !v);
    else { setSortCol(col); setSortAsc(false); }
  }

  const filtered = semCadastro
    .filter(i =>
      i.cpd.toLowerCase().includes(search.toLowerCase()) ||
      (i.descricao || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.codigo_fabricante || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.subgrupo || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let v = 0;
      if (sortCol === "cpd")      v = a.cpd.localeCompare(b.cpd);
      if (sortCol === "descricao") v = (a.descricao || "").localeCompare(b.descricao || "");
      if (sortCol === "subgrupo") v = (a.subgrupo || "").localeCompare(b.subgrupo || "");
      if (sortCol === "estoque")  v = a.estoque_almoxarifado - b.estoque_almoxarifado;
      if (sortCol === "ocs")      v = a.ocs_abertas - b.ocs_abertas;
      if (sortCol === "consumo")  v = (a.consumo_mensal ?? 0) - (b.consumo_mensal ?? 0);
      return sortAsc ? v : -v;
    });

  const bySubgrupo = filtered.reduce<Record<string, InsumoResponse[]>>((acc, i) => {
    const k = i.subgrupo || "(sem subgrupo)";
    (acc[k] ??= []).push(i);
    return acc;
  }, {});

  const subgrupoKeys = Object.keys(bySubgrupo);
  const allCollapsed = subgrupoKeys.length > 0 && subgrupoKeys.every(k => collapsed.has(k));

  function toggleSubgrupo(sg: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(sg) ? next.delete(sg) : next.add(sg);
      return next;
    });
  }
  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(subgrupoKeys));
  }

  const SortTh = ({ col, label, right }: { col: typeof sortCol; label: string; right?: boolean }) => (
    <th
      style={{ textAlign: right ? "right" : "left", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      onClick={() => toggleSort(col)}
    >
      {label} {sortCol === col ? (sortAsc ? "↑" : "↓") : <span style={{ opacity: 0.3 }}>↕</span>}
    </th>
  );

  if (loading) {
    return (
      <div className="table-card" style={{ marginTop: 16 }}>
        <table className="data-table"><tbody>
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)}
        </tbody></table>
      </div>
    );
  }

  if (semCadastro.length === 0) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center", color: "var(--success)" }}>
        Todos os itens possuem estoque mínimo configurado.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="search-input"
          style={{ marginBottom: 0, flex: 1, maxWidth: 360 }}
          placeholder="Buscar CPD, descrição, subgrupo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span
          title={`${semCadastro.length} itens sem cadastro no total — ${semCadastroComConsumo} com consumo ativo`}
          style={{
            padding: "4px 10px", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600,
            background: "rgba(239,68,68,0.12)", color: "var(--danger)",
          }}
        >
          {semCadastroComConsumo} sem cadastro
        </span>
        {mrpAutoCount > 0 && (
          <span title="Excluídos por MRP_AUTO = S (compra por pedido, sem estoque mínimo)" style={{
            padding: "4px 10px", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600,
            background: "rgba(99,102,241,0.1)", color: "var(--accent)",
          }}>
            {mrpAutoCount} MRP excluídos
          </span>
        )}
        {subgrupoKeys.length > 1 && (
          <button className="btn-ghost" style={{ fontSize: "0.78rem", padding: "4px 10px" }} onClick={toggleAll}>
            {allCollapsed ? "Expandir todos" : "Recolher todos"}
          </button>
        )}
        <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          {filtered.length !== semCadastro.length ? `${filtered.length} filtrados` : ""}
        </span>
      </div>

      <div style={{
        padding: "10px 14px", marginBottom: 16,
        background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: 8, fontSize: "0.84rem", color: "var(--warning, #f59e0b)", lineHeight: 1.5,
      }}>
        Itens sem estoque mínimo configurado não participam do alerta de reposição nem das OCs automáticas.
        Configure o estoque mínimo no Delphus.
      </div>

      {Object.entries(bySubgrupo).map(([subgrupo, rows]) => {
        const isCollapsed = collapsed.has(subgrupo);
        return (
        <div key={subgrupo} style={{ marginBottom: 16 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isCollapsed ? 0 : 8, cursor: "pointer", userSelect: "none" }}
            onClick={() => toggleSubgrupo(subgrupo)}
          >
            <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{isCollapsed ? "▸" : "▾"}</span>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>{subgrupo}</span>
            <span style={{
              padding: "1px 7px", borderRadius: 10, fontSize: "0.72rem", fontWeight: 600,
              background: "var(--surface2)", color: "var(--muted)",
            }}>{rows.length}</span>
          </div>
          {!isCollapsed && <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <SortTh col="cpd" label="CPD" />
                  <th>Cod. Fabricante</th>
                  <SortTh col="descricao" label="Descrição" />
                  <SortTh col="consumo" label="Consumo/mês" right />
                  <th style={{ textAlign: "right" }}>Histórico/mês</th>
                  <th style={{ textAlign: "right" }}>Pendente/mês</th>
                  <SortTh col="estoque" label="Est. Atual" right />
                </tr>
              </thead>
              <tbody>
                {rows.flatMap(item => {
                  const isOpen = expanded === item.cpd;
                  const mainRow = (
                    <tr key={item.cpd}
                      style={{ cursor: "pointer", background: isOpen ? "var(--surface2)" : undefined }}
                      onClick={() => setExpanded(isOpen ? null : item.cpd)}
                    >
                      <td style={{ textAlign: "center" }}>
                        <button className="expand-btn" tabIndex={-1}>{isOpen ? "▾" : "▸"}</button>
                      </td>
                      <td>
                        <code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{item.cpd}</code>
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {item.codigo_fabricante || "—"}
                      </td>
                      <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>
                        {item.descricao || "—"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "var(--text)" }}>
                        {(item.consumo_mensal ?? 0) > 0
                          ? (item.consumo_mensal).toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                          : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>
                        {(item.consumo_historico_mensal ?? 0) > 0
                          ? (item.consumo_historico_mensal).toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                          : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: (item.consumo_pendente_mensal ?? 0) > 0 ? "var(--warning)" : "var(--muted)" }}>
                        {(item.consumo_pendente_mensal ?? 0) > 0
                          ? (item.consumo_pendente_mensal).toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                          : "—"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {item.estoque_almoxarifado > 0
                          ? fmt(item.estoque_almoxarifado)
                          : <span style={{ color: "var(--muted)" }}>0,00</span>}
                      </td>
                    </tr>
                  );

                  if (!isOpen) return [mainRow];

                  const drillHeader = (
                    <tr key={`dh-${item.cpd}`} style={{ background: "var(--surface2)" }}>
                      <td colSpan={10} style={{ padding: "4px 20px 4px 40px" }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--muted)", letterSpacing: "0.06em" }}>
                          CHICOTES / PRODUTOS QUE CONSOMEM ESTE INSUMO
                        </span>
                      </td>
                    </tr>
                  );

                  return [mainRow, drillHeader, <ChicoteDrillRow key={`dr-${item.cpd}`} cpd={item.cpd} />];
                })}
              </tbody>
            </table>
          </div>}
        </div>
        );
      })}

    </>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

type TabId = "lista" | "sem-cadastro" | "oc-insumos" | "disparo";

export function InsumosPage() {
  const [tab, setTab]         = useState<TabId>("lista");
  const [items, setItems]     = useState<InsumoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showRegras, setShowRegras] = useState(false);
  const [showSobre, setShowSobre]   = useState(false);

  function loadItems() {
    setLoading(true);
    setError(null);
    InsumosService.getAll()
      .then(setItems)
      .catch(() => setError("Erro ao carregar insumos."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadItems(); }, []);

  const ocFornCount = new Set(
    items.filter(i => compraSugerida(i) !== null).map(i => i.razao_social_fornecedor).filter(Boolean)
  ).size;

  const semCadastroCount = loading ? 0 : items.filter(i => i.estoque_minimo <= 0 && i.mrp_auto !== "S" && i.consumo_mensal > 0).length;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h1 className="page-title">Insumos</h1>
            <p className="page-subtitle">Estoque e ordens de compra · BigQuery em tempo real</p>
          </div>
          <button
            title="Regras de negócio deste módulo"
            onClick={() => setShowRegras(true)}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: "50%",
              width: 28, height: 28, cursor: "pointer", color: "var(--muted)",
              fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 2,
            }}
          >ⓘ</button>
          <SobreButton onClick={() => setShowSobre(true)} />
        </div>
      </div>
      {showRegras && <RegrasModal onClose={() => setShowRegras(false)} />}
      {showSobre  && <SobreModal  onClose={() => setShowSobre(false)} />}

      <div className="tab-bar">
        <button
          className={`tab-btn${tab === "lista" ? " active" : ""}`}
          onClick={() => setTab("lista")}
        >
          Lista Geral
        </button>
        <button
          className={`tab-btn${tab === "sem-cadastro" ? " active" : ""}`}
          onClick={() => setTab("sem-cadastro")}
        >
          Cadastro Pendente
          {!loading && semCadastroCount > 0 && (
            <span style={{ marginLeft: 6, background: "var(--danger, #ef4444)", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: "0.7rem", fontWeight: 600 }}>
              {semCadastroCount}
            </span>
          )}
        </button>
        <button
          className={`tab-btn${tab === "oc-insumos" ? " active" : ""}`}
          onClick={() => setTab("oc-insumos")}
        >
          Pedidos de Compra
          {!loading && ocFornCount > 0 && (
            <span style={{ marginLeft: 6, background: "var(--warning, #f59e0b)", color: "#080808", borderRadius: 10, padding: "1px 6px", fontSize: "0.7rem", fontWeight: 600 }}>
              {ocFornCount}
            </span>
          )}
        </button>
        <button
          className={`tab-btn${tab === "disparo" ? " active" : ""}`}
          onClick={() => setTab("disparo")}
        >
          ✉ Disparo E-mail
        </button>
      </div>

      {tab === "lista" && <InsumosListTab items={items} loading={loading} error={error} onReload={loadItems} />}
      {tab === "sem-cadastro" && <SemCadastroTab items={items} loading={loading} />}
      {tab === "oc-insumos" && (
        <OcPreviewTab
          getPreview={() => OrdensCompraService.getPreviewInsumos()}
          downloadExcel={() => OrdensCompraService.downloadExcelInsumos()}
          titulo="OC Insumos"
        />
      )}
      {tab === "disparo" && (
        <DisparoTab
          modulo="insumos"
          descricao="Envia o Excel de OC de insumos para o operador ERP e um dashboard executivo com o valor estimado de compras para o gestor."
          dispararFn={() => DisparoService.dispararInsumos()}
          getLogFn={() => DisparoService.getLog("insumos")}
        />
      )}
    </div>
  );
}
