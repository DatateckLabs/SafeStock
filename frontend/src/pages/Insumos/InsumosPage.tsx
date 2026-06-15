import { useState, useEffect } from "react";
import { InsumosService } from "../../services/InsumosService";
import { OrdensCompraService } from "../../services/OrdensCompraService";
import { DisparoService } from "../../services/DisparoService";
import { Modal } from "../../components/Modal";
import { OcPreviewTab } from "../../components/OcPreviewCard";
import { useAuth } from "../../auth/useAuth";
import type { InsumoResponse, DisparoLog, DisparoResult } from "../../types";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// ─── Insumos lista ────────────────────────────────────────────────────────────

function InsumosListTab() {
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
              <th>CPD</th>
              <th>Cod. Fabricante</th>
              <th>Descricao</th>
              <th style={{ textAlign: "right" }}>Est. Minimo</th>
              <th style={{ textAlign: "right" }}>OCs em Aberto</th>
              <th style={{ textAlign: "right" }}>Est. Atual</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              <th style={{ textAlign: "right" }}>Compra Sugerida</th>
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
                        <code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{item.cpd}</code>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                        {item.codigo_fabricante || "—"}
                      </td>
                      <td
                        style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {item.descricao || "—"}
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
                      <td style={{ textAlign: "right" }}>
                        <SaldoCell value={saldo} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {(() => {
                          const cs = compraSugerida(item);
                          if (cs === null) return <span style={{ color: "var(--text-dim)" }}>—</span>;
                          return (
                            <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                              {fmt(cs)}
                              {item.moq > 0 && (
                                <span style={{ color: "var(--muted)", fontSize: "0.72rem", marginLeft: 4 }}>
                                  MOQ {fmt(item.moq)}
                                </span>
                              )}
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

// ─── Disparo Tab ──────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function DisparoTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DisparoResult | null>(null);
  const [log, setLog] = useState<DisparoLog[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    DisparoService.getLog()
      .then(setLog)
      .catch(() => {})
      .finally(() => setLogLoading(false));
  }, []);

  async function handleDisparo() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await DisparoService.dispararInsumos();
      setResult(res);
      // recarrega log
      const updated = await DisparoService.getLog();
      setLog(updated);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro ao disparar e-mail.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Painel de ação */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 24,
        marginBottom: 28,
        maxWidth: 560,
      }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--text)", fontWeight: 700 }}>Disparo via E-mail</h3>
        <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.5 }}>
          Envia o Excel de OC de insumos para o operador ERP e um dashboard executivo
          com o valor estimado de compras para o gestor.
        </p>
        <button
          className="btn-accent"
          onClick={handleDisparo}
          disabled={loading}
          style={{ minWidth: 180 }}
        >
          {loading ? "Enviando..." : "✉ Disparar Agora"}
        </button>

        {error && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid var(--danger)", borderRadius: 6, color: "var(--danger)", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{
            marginTop: 16,
            padding: "12px 16px",
            background: result.log.status === "ok" ? "rgba(4,213,4,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${result.log.status === "ok" ? "var(--success)" : "var(--danger)"}`,
            borderRadius: 6,
            fontSize: "0.85rem",
          }}>
            <div style={{ fontWeight: 700, color: result.log.status === "ok" ? "var(--success)" : "var(--danger)", marginBottom: 6 }}>
              {result.log.status === "ok" ? "✓ Enviado com sucesso" : "✗ Erro no disparo"}
            </div>
            <div style={{ color: "var(--text)", lineHeight: 1.7 }}>
              {result.log.total_fornecedores > 0 && <>
                <span style={{ color: "var(--muted)" }}>Fornecedores:</span> {result.log.total_fornecedores} &nbsp;|&nbsp;
                <span style={{ color: "var(--muted)" }}>Itens:</span> {result.log.total_itens}
                {result.log.valor_total_brl != null && <> &nbsp;|&nbsp; <span style={{ color: "var(--muted)" }}>Valor estimado:</span> <strong style={{ color: "var(--accent)" }}>{fmtBRL(result.log.valor_total_brl)}</strong></>}
                {result.log.cotacao_usd_brl && <> &nbsp;|&nbsp; <span style={{ color: "var(--muted)" }}>USD/BRL:</span> {result.log.cotacao_usd_brl.toFixed(4)}</>}
              </>}
              {result.log.erro_msg && <div style={{ color: "var(--danger)", marginTop: 4 }}>{result.log.erro_msg}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Histórico */}
      <h3 style={{ margin: "0 0 12px", color: "var(--text)", fontWeight: 700, fontSize: "1rem" }}>Histórico de Disparos</h3>
      {logLoading ? (
        <p style={{ color: "var(--muted)" }}>Carregando...</p>
      ) : log.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Nenhum disparo registrado.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
            <thead>
              <tr style={{ background: "var(--surface2)" }}>
                {["Data", "Tipo", "Status", "Fornecedores", "Itens", "Valor (BRL)", "USD/BRL", "Arquivo", "Erro"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding: "7px 12px", color: "var(--muted)" }}>{r.tipo}</td>
                  <td style={{ padding: "7px 12px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      background: r.status === "ok" ? "rgba(4,213,4,0.12)" : "rgba(239,68,68,0.12)",
                      color: r.status === "ok" ? "var(--success)" : "var(--danger)",
                    }}>{r.status}</span>
                  </td>
                  <td style={{ padding: "7px 12px", color: "var(--text)", textAlign: "right" }}>{r.total_fornecedores}</td>
                  <td style={{ padding: "7px 12px", color: "var(--text)", textAlign: "right" }}>{r.total_itens}</td>
                  <td style={{ padding: "7px 12px", color: "var(--accent)", fontWeight: 600, textAlign: "right" }}>
                    {r.valor_total_brl != null ? fmtBRL(r.valor_total_brl) : "—"}
                  </td>
                  <td style={{ padding: "7px 12px", color: "var(--muted)", textAlign: "right" }}>
                    {r.cotacao_usd_brl != null ? r.cotacao_usd_brl.toFixed(4) : "—"}
                  </td>
                  <td style={{ padding: "7px 12px", color: "var(--muted)", fontSize: "0.78rem" }}>{r.arquivo_nome ?? "—"}</td>
                  <td style={{ padding: "7px 12px", color: "var(--danger)", fontSize: "0.78rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.erro_msg ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

type TabId = "lista" | "oc-insumos" | "disparo";

export function InsumosPage() {
  const [tab, setTab] = useState<TabId>("lista");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Insumos</h1>
          <p className="page-subtitle">Estoque e ordens de compra · BigQuery em tempo real</p>
        </div>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn${tab === "lista" ? " active" : ""}`}
          onClick={() => setTab("lista")}
        >
          Lista
        </button>
        <button
          className={`tab-btn${tab === "oc-insumos" ? " active" : ""}`}
          onClick={() => setTab("oc-insumos")}
        >
          OC Insumos
        </button>
        <button
          className={`tab-btn${tab === "disparo" ? " active" : ""}`}
          onClick={() => setTab("disparo")}
        >
          ✉ Disparo E-mail
        </button>
      </div>

      {tab === "lista" && <InsumosListTab />}
      {tab === "oc-insumos" && (
        <OcPreviewTab
          getPreview={() => OrdensCompraService.getPreviewInsumos()}
          downloadExcel={() => OrdensCompraService.downloadExcelInsumos()}
          titulo="OC Insumos"
        />
      )}
      {tab === "disparo" && <DisparoTab />}
    </div>
  );
}
