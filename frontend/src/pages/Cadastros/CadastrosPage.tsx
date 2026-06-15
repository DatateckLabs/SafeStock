import { useState, useEffect } from "react";
import { ParametrosService } from "../../services/ParametrosService";
import { EstoquesMinimoService } from "../../services/EstoquesMinimoService";
import { CriticidadesService } from "../../services/CriticidadesService";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { ParametroGlobal, EstoqueMinimo, CriticidadeFerramenta } from "../../types";

type Aba = "parametros" | "estoques" | "criticidades";

export function CadastrosPage() {
  const [aba, setAba] = useState<Aba>("parametros");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cadastros</h1>
          <p className="page-subtitle">Parâmetros e configurações do sistema</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid #2e3250" }}>
        {(["parametros", "estoques", "criticidades"] as Aba[]).map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            style={{
              background: aba === a ? "#22263a" : "none",
              border: "none",
              borderBottom: aba === a ? "2px solid #0ea5e9" : "2px solid transparent",
              color: aba === a ? "#e2e8f0" : "#64748b",
              padding: "8px 18px",
              cursor: "pointer",
              fontWeight: aba === a ? 600 : 400,
              fontSize: "0.88rem",
              marginBottom: -1,
            }}
          >
            {a === "parametros" ? "Parâmetros Globais" : a === "estoques" ? "Estoque Mínimo" : "Criticidade Ferramentas"}
          </button>
        ))}
      </div>

      {aba === "parametros" && <TabParametros />}
      {aba === "estoques"   && <TabEstoques />}
      {aba === "criticidades" && <TabCriticidades />}
    </div>
  );
}

function TabParametros() {
  const [items, setItems]     = useState<ParametroGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState<string | null>(null);

  useEffect(() => {
    ParametrosService.getAll().then(setItems).finally(() => setLoading(false));
  }, []);

  function startEdit(p: ParametroGlobal) {
    setEditing(prev => ({ ...prev, [p.chave]: p.valor }));
  }

  async function salvar(chave: string) {
    setSaving(chave);
    try {
      const updated = await ParametrosService.update(chave, editing[chave]);
      setItems(prev => prev.map(p => p.chave === chave ? updated : p));
      setEditing(prev => { const e = { ...prev }; delete e[chave]; return e; });
    } catch {
      alert("Erro ao salvar.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr><th>Chave</th><th>Valor</th><th>Descrição</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {items.map(p => (
            <tr key={p.chave}>
              <td><code style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{p.chave}</code></td>
              <td>
                {p.chave in editing ? (
                  <input
                    className="form-input"
                    style={{ width: "100%", minWidth: 160 }}
                    value={editing[p.chave]}
                    onChange={e => setEditing(prev => ({ ...prev, [p.chave]: e.target.value }))}
                  />
                ) : (
                  <span style={{ color: "#e2e8f0" }}>{p.valor || <em style={{ color: "#64748b" }}>vazio</em>}</span>
                )}
              </td>
              <td style={{ color: "#64748b", fontSize: "0.82rem" }}>{p.descricao || "—"}</td>
              <td>
                {p.chave in editing ? (
                  <>
                    <button className="btn-primary btn-sm" onClick={() => salvar(p.chave)} disabled={saving === p.chave}>
                      {saving === p.chave ? "..." : "Salvar"}
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(prev => { const e = { ...prev }; delete e[p.chave]; return e; })}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button className="btn-ghost btn-sm" onClick={() => startEdit(p)}>Editar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabEstoques() {
  const [items, setItems]     = useState<EstoqueMinimo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm]       = useState({ estoque_minimo: 0, estoque_maximo: 0, observacao: "" });
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    EstoquesMinimoService.getAll().then(setItems).finally(() => setLoading(false));
  }, []);

  function startEdit(e: EstoqueMinimo) {
    setEditing(e.cpd);
    setForm({ estoque_minimo: e.estoque_minimo, estoque_maximo: e.estoque_maximo, observacao: e.observacao || "" });
  }

  async function salvar() {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await EstoquesMinimoService.upsert(editing, form);
      setItems(prev => prev.map(e => e.cpd === editing ? updated : e));
      setEditing(null);
    } catch { alert("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr><th>CPD</th><th>Mínimo</th><th>Máximo</th><th>Observação</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {items.map(e => (
            <tr key={e.cpd}>
              <td><code style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{e.cpd}</code></td>
              <td>
                {editing === e.cpd
                  ? <input className="form-input" type="number" step="0.01" value={form.estoque_minimo} onChange={x => setForm(f => ({ ...f, estoque_minimo: parseFloat(x.target.value) || 0 }))} />
                  : e.estoque_minimo.toFixed(2)}
              </td>
              <td>
                {editing === e.cpd
                  ? <input className="form-input" type="number" step="0.01" value={form.estoque_maximo} onChange={x => setForm(f => ({ ...f, estoque_maximo: parseFloat(x.target.value) || 0 }))} />
                  : e.estoque_maximo.toFixed(2)}
              </td>
              <td style={{ color: "#64748b", fontSize: "0.82rem" }}>
                {editing === e.cpd
                  ? <input className="form-input" value={form.observacao} onChange={x => setForm(f => ({ ...f, observacao: x.target.value }))} />
                  : e.observacao || "—"}
              </td>
              <td>
                {editing === e.cpd
                  ? <>
                    <button className="btn-primary btn-sm" onClick={salvar} disabled={saving}>{saving ? "..." : "Salvar"}</button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
                  </>
                  : <button className="btn-ghost btn-sm" onClick={() => startEdit(e)}>Editar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="empty-state">Nenhum CPD cadastrado ainda. Use a tela de Insumos para adicionar.</p>}
    </div>
  );
}

function TabCriticidades() {
  const [items, setItems]     = useState<CriticidadeFerramenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm]       = useState({ criticidade: "media" as "alta" | "media" | "baixa", janela_consumo_dias: "", threshold_inatividade: "", observacao: "" });
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    CriticidadesService.getAll().then(setItems).finally(() => setLoading(false));
  }, []);

  function startEdit(c: CriticidadeFerramenta) {
    setEditing(c.cpd_ferramenta);
    setForm({
      criticidade: c.criticidade,
      janela_consumo_dias: c.janela_consumo_dias != null ? String(c.janela_consumo_dias) : "",
      threshold_inatividade: c.threshold_inatividade != null ? String(c.threshold_inatividade) : "",
      observacao: c.observacao || "",
    });
  }

  async function salvar() {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await CriticidadesService.upsert(editing, {
        criticidade: form.criticidade,
        janela_consumo_dias: form.janela_consumo_dias ? parseInt(form.janela_consumo_dias) : null,
        threshold_inatividade: form.threshold_inatividade ? parseFloat(form.threshold_inatividade) : null,
        observacao: form.observacao || undefined,
      });
      setItems(prev => prev.map(c => c.cpd_ferramenta === editing ? updated : c));
      setEditing(null);
    } catch { alert("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr><th>CPD Ferramenta</th><th>Criticidade</th><th>Janela (dias)</th><th>Threshold</th><th>Obs.</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {items.map(c => (
            <tr key={c.cpd_ferramenta}>
              <td><code style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{c.cpd_ferramenta}</code></td>
              <td>
                {editing === c.cpd_ferramenta
                  ? <select className="filter-select" value={form.criticidade} onChange={e => setForm(f => ({ ...f, criticidade: e.target.value as "alta" | "media" | "baixa" }))}>
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                  : <span className={`badge ${c.criticidade === "alta" ? "badge-red" : c.criticidade === "media" ? "badge-yellow" : "badge-green"}`}>{c.criticidade}</span>}
              </td>
              <td>
                {editing === c.cpd_ferramenta
                  ? <input className="form-input" style={{ width: 80 }} type="number" value={form.janela_consumo_dias} placeholder="global" onChange={e => setForm(f => ({ ...f, janela_consumo_dias: e.target.value }))} />
                  : c.janela_consumo_dias ?? <em style={{ color: "#64748b" }}>global</em>}
              </td>
              <td>
                {editing === c.cpd_ferramenta
                  ? <input className="form-input" style={{ width: 80 }} type="number" value={form.threshold_inatividade} placeholder="global" onChange={e => setForm(f => ({ ...f, threshold_inatividade: e.target.value }))} />
                  : c.threshold_inatividade ?? <em style={{ color: "#64748b" }}>global</em>}
              </td>
              <td style={{ fontSize: "0.82rem", color: "#64748b" }}>
                {editing === c.cpd_ferramenta
                  ? <input className="form-input" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
                  : c.observacao || "—"}
              </td>
              <td>
                {editing === c.cpd_ferramenta
                  ? <>
                    <button className="btn-primary btn-sm" onClick={salvar} disabled={saving}>{saving ? "..." : "Salvar"}</button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
                  </>
                  : <button className="btn-ghost btn-sm" onClick={() => startEdit(c)}>Editar</button>}
              </td>
            </tr>
          ))}
        </tbody>
        {items.length === 0 && <tr><td colSpan={6}><p className="empty-state">Nenhuma criticidade cadastrada.</p></td></tr>}
      </table>
    </div>
  );
}
