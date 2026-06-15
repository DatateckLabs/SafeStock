import { useState, useEffect } from "react";
import { InsumosService } from "../../services/InsumosService";
import { FerramentasService } from "../../services/FerramentasService";
import { Modal } from "../../components/Modal";
import { useAuth } from "../../auth/useAuth";
import type { InsumoResponse, FerramentaResponse, DrilldownItem } from "../../types";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function saldoInsumo(i: InsumoResponse): number | null {
  if (i.estoque_minimo <= 0) return null;
  return i.estoque_almoxarifado - i.estoque_minimo;
}

function saldoFerramenta(f: FerramentaResponse): number {
  return f.estoque_atual - f.estoque_minimo_calculado;
}

function sortBySaldoInsumo(items: InsumoResponse[]): InsumoResponse[] {
  return [...items].sort((a, b) => {
    const sa = saldoInsumo(a) ?? Infinity;
    const sb = saldoInsumo(b) ?? Infinity;
    return sa - sb;
  });
}

function sortBySaldoFerramenta(items: FerramentaResponse[]): FerramentaResponse[] {
  return [...items].sort((a, b) => saldoFerramenta(a) - saldoFerramenta(b));
}

// ─── shared components ────────────────────────────────────────────────────────

function SaldoCell({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "#475569" }}>—</span>;
  if (value > 0)
    return <span style={{ color: "#22c55e", fontWeight: 600 }}>+{fmt(value)}</span>;
  if (value < 0)
    return <span style={{ color: "#ef4444", fontWeight: 600 }}>−{fmt(Math.abs(value))}</span>;
  return <span style={{ color: "#64748b" }}>0,00</span>;
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

// ─── Insumos tab ──────────────────────────────────────────────────────────────

function InsumosTab() {
  const { user } = useAuth();
  const [items, setItems]       = useState<InsumoResponse[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [editItem, setEditItem] = useState<InsumoResponse | null>(null);
  const [formMin, setFormMin]   = useState(0);
  const [formMax, setFormMax]   = useState(0);
  const [saving, setSaving]     = useState(false);

  const canEdit = user?.role === "admin" || user?.role === "gestor";

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    setError(null);
    InsumosService.getAll()
      .then(setItems)
      .catch(() => setError("Erro ao carregar insumos."))
      .finally(() => setLoading(false));
  }

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
        (i.descricao || "").toLowerCase().includes(search.toLowerCase())
    )
  );

  const cols = canEdit ? 7 : 6;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input
          className="search-input"
          style={{ marginBottom: 0, flex: 1, maxWidth: 360 }}
          placeholder="Buscar por CPD ou descrição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ color: "#475569", fontSize: "0.82rem" }}>
          {loading ? "…" : `${filtered.length} itens`}
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>CPD</th>
              <th>Descrição</th>
              <th style={{ textAlign: "right" }}>Est. Mínimo</th>
              <th style={{ textAlign: "right" }}>OCs em Aberto</th>
              <th style={{ textAlign: "right" }}>Est. Atual</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              {canEdit && <th style={{ width: 40 }} />}
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
                        <code style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{item.cpd}</code>
                      </td>
                      <td
                        style={{
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.descricao || "—"}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          color: item.estoque_minimo > 0 ? "#e2e8f0" : "#475569",
                        }}
                      >
                        {item.estoque_minimo > 0 ? fmt(item.estoque_minimo) : "—"}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          color: item.ocs_abertas > 0 ? "#0ea5e9" : "#475569",
                        }}
                      >
                        {fmt(item.ocs_abertas)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {fmt(item.estoque_almoxarifado)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <SaldoCell value={saldo} />
                      </td>
                      {canEdit && (
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="expand-btn"
                            title="Editar mínimo/máximo"
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
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: 16 }}>
            {editItem.descricao}
          </p>
          <label className="form-label">Estoque mínimo</label>
          <input
            className="form-input"
            type="number"
            step="0.01"
            value={formMin}
            onChange={e => setFormMin(parseFloat(e.target.value) || 0)}
          />
          <label className="form-label" style={{ marginTop: 12 }}>
            Estoque máximo
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

// ─── Ferramentas tab ──────────────────────────────────────────────────────────

function FerramentasTab() {
  const [items, setItems]       = useState<FerramentaResponse[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drillMap, setDrillMap] = useState<Record<string, DrilldownItem[]>>({});
  const [drilling, setDrilling] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    setError(null);
    FerramentasService.getAll()
      .then(setItems)
      .catch(() => setError("Erro ao carregar ferramentas."))
      .finally(() => setLoading(false));
  }

  function toggle(cpd: string) {
    if (expanded === cpd) {
      setExpanded(null);
      return;
    }
    setExpanded(cpd);
    if (!drillMap[cpd]) {
      setDrilling(cpd);
      FerramentasService.getDrilldown(cpd)
        .then(data => setDrillMap(m => ({ ...m, [cpd]: data })))
        .catch(() => setDrillMap(m => ({ ...m, [cpd]: [] })))
        .finally(() => setDrilling(null));
    }
  }

  const filtered = sortBySaldoFerramenta(
    items.filter(
      i =>
        i.cpd_ferramenta.toLowerCase().includes(search.toLowerCase()) ||
        (i.descricao || "").toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input
          className="search-input"
          style={{ marginBottom: 0, flex: 1, maxWidth: 360 }}
          placeholder="Buscar por CPD ou descrição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ color: "#475569", fontSize: "0.82rem" }}>
          {loading ? "…" : `${filtered.length} ferramentas`}
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              <th>CPD</th>
              <th>Descrição</th>
              <th style={{ textAlign: "right" }}>Consumo Mensal</th>
              <th style={{ textAlign: "right" }}>Est. Mínimo</th>
              <th style={{ textAlign: "right" }}>OCs em Aberto</th>
              <th style={{ textAlign: "right" }}>Est. Atual</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <SkeletonRow key={i} cols={8} />
                ))
              : filtered.flatMap(item => {
                  const saldo = saldoFerramenta(item);
                  const isOpen = expanded === item.cpd_ferramenta;
                  const drill = drillMap[item.cpd_ferramenta];
                  const isLoading = drilling === item.cpd_ferramenta;

                  const mainRow = (
                    <tr
                      key={item.cpd_ferramenta}
                      style={{
                        cursor: "pointer",
                        background: isOpen ? "#1e2235" : undefined,
                      }}
                      onClick={() => toggle(item.cpd_ferramenta)}
                    >
                      <td style={{ textAlign: "center" }}>
                        <button className="expand-btn" tabIndex={-1}>
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>
                      <td>
                        <code style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                          {item.cpd_ferramenta}
                        </code>
                      </td>
                      <td
                        style={{
                          maxWidth: 240,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.descricao || "—"}
                      </td>
                      <td style={{ textAlign: "right", color: "#94a3b8" }}>
                        {fmt(item.consumo_mensal)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {item.estoque_minimo_calculado > 0 ? (
                          fmt(item.estoque_minimo_calculado)
                        ) : (
                          <span style={{ color: "#475569" }}>0,00</span>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          color: item.ocs_abertas > 0 ? "#0ea5e9" : "#475569",
                        }}
                      >
                        {fmt(item.ocs_abertas)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {fmt(item.estoque_atual)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <SaldoCell value={saldo} />
                      </td>
                    </tr>
                  );

                  if (!isOpen) return [mainRow];

                  const drillRow = (
                    <tr key={`drill-${item.cpd_ferramenta}`} className="drill-row">
                      <td colSpan={8}>
                        <div className="drill-inner">
                          {isLoading ? (
                            <p style={{ color: "#475569", padding: "10px 0", fontSize: "0.83rem" }}>
                              Carregando terminais...
                            </p>
                          ) : !drill || drill.length === 0 ? (
                            <p style={{ color: "#475569", padding: "10px 0", fontSize: "0.83rem" }}>
                              Nenhuma OP pendente encontrada para esta ferramenta.
                            </p>
                          ) : (
                            <table className="drill-table">
                              <thead>
                                <tr>
                                  <th>Terminal (CPD)</th>
                                  <th>Descrição</th>
                                  <th style={{ textAlign: "right" }}>OPs Pendentes</th>
                                  <th style={{ textAlign: "right" }}>Consumo Mensal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {drill.map(d => (
                                  <tr key={d.cpd_materia_prima}>
                                    <td>
                                      <code style={{ fontSize: "0.78rem" }}>
                                        {d.cpd_materia_prima}
                                      </code>
                                    </td>
                                    <td
                                      style={{
                                        maxWidth: 240,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {d.descricao || "—"}
                                    </td>
                                    <td style={{ textAlign: "right" }}>{fmt(d.ops_pendentes)}</td>
                                    <td style={{ textAlign: "right" }}>
                                      {fmt(d.consumo_mensal_ferramenta)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  );

                  return [mainRow, drillRow];
                })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <p className="empty-state">Nenhuma ferramenta encontrada.</p>
        )}
      </div>
    </>
  );
}

// ─── Combined page ────────────────────────────────────────────────────────────

export function InsumosPage({ defaultTab = "insumos" }: { defaultTab?: "insumos" | "ferramentas" }) {
  const [tab, setTab]           = useState<"insumos" | "ferramentas">(defaultTab);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">Insumos e ferramentas · dados em tempo real do BigQuery</p>
        </div>
        <button
          className="btn-ghost"
          onClick={() => setRefreshKey(k => k + 1)}
          style={{ fontSize: "0.82rem" }}
        >
          ↺ Atualizar
        </button>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn${tab === "insumos" ? " active" : ""}`}
          onClick={() => setTab("insumos")}
        >
          Insumos
        </button>
        <button
          className={`tab-btn${tab === "ferramentas" ? " active" : ""}`}
          onClick={() => setTab("ferramentas")}
        >
          Ferramentas
        </button>
      </div>

      {tab === "insumos" ? (
        <InsumosTab key={`insumos-${refreshKey}`} />
      ) : (
        <FerramentasTab key={`ferramentas-${refreshKey}`} />
      )}
    </div>
  );
}
