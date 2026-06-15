import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ParametrosService } from "../../services/ParametrosService";
import { EstoquesMinimoService } from "../../services/EstoquesMinimoService";
import { CriticidadesService } from "../../services/CriticidadesService";
import { ConfigFornecedorService } from "../../services/ConfigFornecedorService";
import { ConfigFerramentaService } from "../../services/ConfigFerramentaService";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { ParametroGlobal, EstoqueMinimo, CriticidadeFerramenta, ConfigFornecedor, ConfigFerramenta } from "../../types";

type Aba = "parametros" | "estoques" | "criticidades" | "fornecedores" | "ferramentas_cfg";

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
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        {([
          ["parametros",      "Parâmetros Globais"],
          ["estoques",        "Estoque Mínimo"],
          ["criticidades",    "Criticidade Ferramentas"],
          ["fornecedores",    "Fornecedores"],
          ["ferramentas_cfg", "Config. Ferramentas"],
        ] as [Aba, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: aba === id ? "2px solid var(--accent)" : "2px solid transparent",
              color: aba === id ? "var(--accent)" : "var(--muted)",
              padding: "8px 18px",
              cursor: "pointer",
              fontWeight: aba === id ? 600 : 400,
              fontSize: "0.88rem",
              marginBottom: -1,
              fontFamily: "inherit",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "parametros"      && <TabParametros />}
      {aba === "estoques"        && <TabEstoques />}
      {aba === "criticidades"    && <TabCriticidades />}
      {aba === "fornecedores"    && <TabFornecedores />}
      {aba === "ferramentas_cfg" && <TabFerramentasCfg />}
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
              <td><code style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{p.chave}</code></td>
              <td>
                {p.chave in editing ? (
                  <input
                    className="form-input"
                    style={{ width: "100%", minWidth: 160 }}
                    value={editing[p.chave]}
                    onChange={e => setEditing(prev => ({ ...prev, [p.chave]: e.target.value }))}
                  />
                ) : (
                  <span style={{ color: "var(--text)" }}>{p.valor || <em style={{ color: "var(--muted)" }}>vazio</em>}</span>
                )}
              </td>
              <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{p.descricao || "—"}</td>
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
              <td><code style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{e.cpd}</code></td>
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
              <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
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
  const [form, setForm]       = useState({ criticidade: "media" as "alta" | "media" | "baixa", threshold_inatividade: "", observacao: "" });
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    CriticidadesService.getAll().then(setItems).finally(() => setLoading(false));
  }, []);

  function startEdit(c: CriticidadeFerramenta) {
    setEditing(c.cpd_ferramenta);
    setForm({
      criticidade: c.criticidade,
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
        janela_consumo_dias: null,
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
          <tr><th>CPD Ferramenta</th><th>Criticidade</th><th>Threshold inatividade</th><th>Obs.</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {items.map(c => (
            <tr key={c.cpd_ferramenta}>
              <td><code style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{c.cpd_ferramenta}</code></td>
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
                  ? <input className="form-input" style={{ width: 80 }} type="number" value={form.threshold_inatividade} placeholder="global" onChange={e => setForm(f => ({ ...f, threshold_inatividade: e.target.value }))} />
                  : c.threshold_inatividade ?? <em style={{ color: "var(--muted)" }}>global</em>}
              </td>
              <td style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
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
        {items.length === 0 && <tr><td colSpan={5}><p className="empty-state">Nenhuma criticidade cadastrada.</p></td></tr>}
      </table>
    </div>
  );
}

// ─── Autocomplete de fornecedor ───────────────────────────────────────────────

function FornecedorCombobox({
  value,
  onChange,
  sugestoes,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  sugestoes: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const filtered = value.length >= 1
    ? sugestoes.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 12)
    : [];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleFocusOrChange(newValue?: string) {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setOpen(true);
    if (newValue !== undefined) onChange(newValue);
  }

  const dropdown = open && filtered.length > 0 && rect ? createPortal(
    <div
      style={{
        position: "fixed",
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        maxHeight: 280,
        overflowY: "auto",
      }}
    >
      {filtered.map(s => (
        <div
          key={s}
          onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "0.84rem",
            color: s.toLowerCase() === value.toLowerCase() ? "var(--accent)" : "var(--text)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--border)")}
          onMouseLeave={e => (e.currentTarget.style.background = "")}
        >
          {s}
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <input
        ref={inputRef}
        className="form-input"
        style={{ width: "100%", minWidth: 260 }}
        placeholder={placeholder ?? "Buscar fornecedor..."}
        value={value}
        onChange={e => handleFocusOrChange(e.target.value)}
        onFocus={() => handleFocusOrChange()}
        autoComplete="off"
      />
      {dropdown}
    </>
  );
}

// ─── Tab Fornecedores ─────────────────────────────────────────────────────────

const FORM_FORN_EMPTY = { razao_social: "", leadtime_meses: "2", cobertura_meses: "2" };

function TabFornecedores() {
  const [items, setItems]         = useState<ConfigFornecedor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<string | null>(null);
  const [form, setForm]           = useState({ leadtime_meses: "2", cobertura_meses: "2" });
  const [adding, setAdding]       = useState(false);
  const [newForm, setNewForm]     = useState(FORM_FORN_EMPTY);
  const [saving, setSaving]       = useState(false);
  const [sugestoes, setSugestoes] = useState<string[]>([]);

  useEffect(() => {
    ConfigFornecedorService.getAll().then(setItems).finally(() => setLoading(false));
    ConfigFornecedorService.getSugestoes().then(setSugestoes).catch(() => {});
  }, []);

  function startEdit(c: ConfigFornecedor) {
    setEditing(c.razao_social);
    setForm({ leadtime_meses: String(c.leadtime_meses), cobertura_meses: String(c.cobertura_meses) });
  }

  async function salvar(razao_social: string) {
    setSaving(true);
    try {
      const updated = await ConfigFornecedorService.upsert(razao_social, {
        leadtime_meses:  parseFloat(form.leadtime_meses)  || 0,
        cobertura_meses: parseFloat(form.cobertura_meses) || 0,
      });
      setItems(prev => prev.map(c => c.razao_social === razao_social ? updated : c));
      setEditing(null);
    } catch { alert("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  async function salvarNovo() {
    if (!newForm.razao_social.trim()) return;
    setSaving(true);
    try {
      const created = await ConfigFornecedorService.upsert(newForm.razao_social.trim(), {
        leadtime_meses:  parseFloat(newForm.leadtime_meses)  || 0,
        cobertura_meses: parseFloat(newForm.cobertura_meses) || 0,
      });
      setItems(prev => [...prev, created].sort((a, b) => a.razao_social.localeCompare(b.razao_social)));
      setAdding(false);
      setNewForm(FORM_FORN_EMPTY);
    } catch { alert("Erro ao adicionar."); }
    finally { setSaving(false); }
  }

  async function excluir(razao_social: string) {
    if (!confirm(`Remover "${razao_social}"?`)) return;
    try {
      await ConfigFornecedorService.deletar(razao_social);
      setItems(prev => prev.filter(c => c.razao_social !== razao_social));
    } catch { alert("Erro ao excluir."); }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="table-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: 0 }}>
          Estoque mínimo = consumo_mensal × (cobertura + leadtime) ÷ aplicações
        </p>
        {!adding && (
          <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>+ Adicionar</button>
        )}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Fornecedor (Razão Social)</th>
            <th style={{ textAlign: "right" }}>Leadtime (meses)</th>
            <th style={{ textAlign: "right" }}>Cobertura (meses)</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map(c => (
            <tr key={c.razao_social}>
              <td style={{ fontSize: "0.85rem" }}>{c.razao_social}</td>
              <td style={{ textAlign: "right" }}>
                {editing === c.razao_social
                  ? <input className="form-input" style={{ width: 70, textAlign: "right" }} type="number" step="0.5" min="0" value={form.leadtime_meses} onChange={e => setForm(f => ({ ...f, leadtime_meses: e.target.value }))} />
                  : c.leadtime_meses}
              </td>
              <td style={{ textAlign: "right" }}>
                {editing === c.razao_social
                  ? <input className="form-input" style={{ width: 70, textAlign: "right" }} type="number" step="0.5" min="0" value={form.cobertura_meses} onChange={e => setForm(f => ({ ...f, cobertura_meses: e.target.value }))} />
                  : c.cobertura_meses}
              </td>
              <td>
                {editing === c.razao_social ? (
                  <>
                    <button className="btn-primary btn-sm" onClick={() => salvar(c.razao_social)} disabled={saving}>{saving ? "..." : "Salvar"}</button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button className="btn-ghost btn-sm" onClick={() => startEdit(c)}>Editar</button>
                    <button className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => excluir(c.razao_social)}>Excluir</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {adding && (
            <tr style={{ background: "var(--surface2)" }}>
              <td>
                <FornecedorCombobox
                  value={newForm.razao_social}
                  onChange={v => setNewForm(f => ({ ...f, razao_social: v }))}
                  sugestoes={sugestoes}
                  placeholder="Buscar fornecedor do MRP..."
                />
              </td>
              <td style={{ textAlign: "right" }}>
                <input className="form-input" style={{ width: 70, textAlign: "right" }} type="number" step="0.5" min="0" value={newForm.leadtime_meses} onChange={e => setNewForm(f => ({ ...f, leadtime_meses: e.target.value }))} />
              </td>
              <td style={{ textAlign: "right" }}>
                <input className="form-input" style={{ width: 70, textAlign: "right" }} type="number" step="0.5" min="0" value={newForm.cobertura_meses} onChange={e => setNewForm(f => ({ ...f, cobertura_meses: e.target.value }))} />
              </td>
              <td>
                <button className="btn-primary btn-sm" onClick={salvarNovo} disabled={saving || !newForm.razao_social.trim()}>{saving ? "..." : "Salvar"}</button>
                <button className="btn-ghost btn-sm" onClick={() => { setAdding(false); setNewForm(FORM_FORN_EMPTY); }}>Cancelar</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {items.length === 0 && !adding && <p className="empty-state">Nenhum fornecedor configurado. Clique em "+ Adicionar".</p>}
    </div>
  );
}

// ─── Tab Config. Ferramentas ──────────────────────────────────────────────────

const FORM_CFG_EMPTY = { cpd_ferramenta: "", aplicacoes: "80000", leadtime_override: "" };

function TabFerramentasCfg() {
  const [items, setItems]     = useState<ConfigFerramenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm]       = useState({ aplicacoes: "80000", leadtime_override: "" });
  const [adding, setAdding]   = useState(false);
  const [newForm, setNewForm] = useState(FORM_CFG_EMPTY);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    ConfigFerramentaService.getAll().then(setItems).finally(() => setLoading(false));
  }, []);

  function startEdit(c: ConfigFerramenta) {
    setEditing(c.cpd_ferramenta);
    setForm({
      aplicacoes:        String(c.aplicacoes),
      leadtime_override: c.leadtime_override != null ? String(c.leadtime_override) : "",
    });
  }

  async function salvar(cpd: string) {
    setSaving(true);
    try {
      const updated = await ConfigFerramentaService.upsert(cpd, {
        aplicacoes:        parseInt(form.aplicacoes)   || 80_000,
        leadtime_override: form.leadtime_override !== "" ? parseFloat(form.leadtime_override) : null,
      });
      setItems(prev => prev.map(c => c.cpd_ferramenta === cpd ? updated : c));
      setEditing(null);
    } catch { alert("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  async function salvarNovo() {
    if (!newForm.cpd_ferramenta.trim()) return;
    setSaving(true);
    try {
      const created = await ConfigFerramentaService.upsert(newForm.cpd_ferramenta.trim(), {
        aplicacoes:        parseInt(newForm.aplicacoes)   || 80_000,
        leadtime_override: newForm.leadtime_override !== "" ? parseFloat(newForm.leadtime_override) : null,
      });
      setItems(prev => [...prev, created].sort((a, b) => a.cpd_ferramenta.localeCompare(b.cpd_ferramenta)));
      setAdding(false);
      setNewForm(FORM_CFG_EMPTY);
    } catch { alert("Erro ao adicionar."); }
    finally { setSaving(false); }
  }

  async function excluir(cpd: string) {
    if (!confirm(`Remover configuração da ferramenta ${cpd}?`)) return;
    try {
      await ConfigFerramentaService.deletar(cpd);
      setItems(prev => prev.filter(c => c.cpd_ferramenta !== cpd));
    } catch { alert("Erro ao excluir."); }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="table-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: 0 }}>
          Sobrescreve o leadtime do fornecedor por ferramenta. Aplicações default: 80.000.
        </p>
        {!adding && (
          <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>+ Adicionar</button>
        )}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>CPD Ferramenta</th>
            <th style={{ textAlign: "right" }}>Aplicações</th>
            <th style={{ textAlign: "right" }}>Leadtime override (meses)</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map(c => (
            <tr key={c.cpd_ferramenta}>
              <td><code style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{c.cpd_ferramenta}</code></td>
              <td style={{ textAlign: "right" }}>
                {editing === c.cpd_ferramenta
                  ? <input className="form-input" style={{ width: 90, textAlign: "right" }} type="number" min="1" value={form.aplicacoes} onChange={e => setForm(f => ({ ...f, aplicacoes: e.target.value }))} />
                  : c.aplicacoes.toLocaleString("pt-BR")}
              </td>
              <td style={{ textAlign: "right" }}>
                {editing === c.cpd_ferramenta
                  ? <input className="form-input" style={{ width: 70, textAlign: "right" }} type="number" step="0.5" min="0" placeholder="do fornecedor" value={form.leadtime_override} onChange={e => setForm(f => ({ ...f, leadtime_override: e.target.value }))} />
                  : c.leadtime_override != null ? c.leadtime_override : <em style={{ color: "var(--muted)" }}>do fornecedor</em>}
              </td>
              <td>
                {editing === c.cpd_ferramenta ? (
                  <>
                    <button className="btn-primary btn-sm" onClick={() => salvar(c.cpd_ferramenta)} disabled={saving}>{saving ? "..." : "Salvar"}</button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button className="btn-ghost btn-sm" onClick={() => startEdit(c)}>Editar</button>
                    <button className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => excluir(c.cpd_ferramenta)}>Excluir</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {adding && (
            <tr style={{ background: "var(--surface2)" }}>
              <td>
                <input className="form-input" placeholder="CPD da ferramenta" value={newForm.cpd_ferramenta} onChange={e => setNewForm(f => ({ ...f, cpd_ferramenta: e.target.value }))} style={{ width: 120 }} />
              </td>
              <td style={{ textAlign: "right" }}>
                <input className="form-input" style={{ width: 90, textAlign: "right" }} type="number" min="1" value={newForm.aplicacoes} onChange={e => setNewForm(f => ({ ...f, aplicacoes: e.target.value }))} />
              </td>
              <td style={{ textAlign: "right" }}>
                <input className="form-input" style={{ width: 70, textAlign: "right" }} type="number" step="0.5" min="0" placeholder="do fornecedor" value={newForm.leadtime_override} onChange={e => setNewForm(f => ({ ...f, leadtime_override: e.target.value }))} />
              </td>
              <td>
                <button className="btn-primary btn-sm" onClick={salvarNovo} disabled={saving || !newForm.cpd_ferramenta.trim()}>{saving ? "..." : "Salvar"}</button>
                <button className="btn-ghost btn-sm" onClick={() => { setAdding(false); setNewForm(FORM_CFG_EMPTY); }}>Cancelar</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {items.length === 0 && !adding && <p className="empty-state">Nenhuma ferramenta configurada. Clique em "+ Adicionar".</p>}
    </div>
  );
}
