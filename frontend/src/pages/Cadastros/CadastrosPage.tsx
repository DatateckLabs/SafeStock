import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ParametrosService } from "../../services/ParametrosService";
import { ConfigFornecedorService } from "../../services/ConfigFornecedorService";
import { ConfigFerramentaService } from "../../services/ConfigFerramentaService";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { ParametroGlobal, ConfigFornecedor, ConfigFerramenta } from "../../types";

const PARAMS_OCULTOS = new Set([
  "smtp_host", "smtp_port", "smtp_user",
  "email_operacional", "email_gestor",
  "cron_dia_semana", "cron_hora", "cron_agendamentos",
  "email_destino_oc",
]);

type Aba = "parametros" | "fornecedores" | "ferramentas_cfg" | "agendamento";

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
          ["fornecedores",    "Fornecedores"],
          ["ferramentas_cfg", "Config. Ferramentas"],
          ["agendamento",     "✉ Agendamento"],
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
      {aba === "fornecedores"    && <TabFornecedores />}
      {aba === "ferramentas_cfg" && <TabFerramentasCfg />}
      {aba === "agendamento"     && <TabAgendamento />}
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
          {items.filter(p => !PARAMS_OCULTOS.has(p.chave)).map(p => (
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

const FORM_CFG_EMPTY = { cpd_ferramenta: "", leadtime_override: "" };

function TabFerramentasCfg() {
  const [items, setItems]     = useState<ConfigFerramenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm]       = useState({ leadtime_override: "" });
  const [adding, setAdding]   = useState(false);
  const [newForm, setNewForm] = useState(FORM_CFG_EMPTY);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    ConfigFerramentaService.getAll().then(setItems).finally(() => setLoading(false));
  }, []);

  function startEdit(c: ConfigFerramenta) {
    setEditing(c.cpd_ferramenta);
    setForm({ leadtime_override: c.leadtime_override != null ? String(c.leadtime_override) : "" });
  }

  async function salvar(cpd: string) {
    setSaving(true);
    try {
      const updated = await ConfigFerramentaService.upsert(cpd, {
        aplicacoes: 80_000,
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
        aplicacoes: 80_000,
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
          Exceção de leadtime por ferramenta — sobrescreve o valor do fornecedor. Durabilidade gerenciada pelo ToolGuard.
        </p>
        {!adding && (
          <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>+ Adicionar</button>
        )}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>CPD Ferramenta</th>
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
      {items.length === 0 && !adding && <p className="empty-state">Nenhuma exceção de leadtime cadastrada. Clique em "+ Adicionar".</p>}
    </div>
  );
}

// ─── Tab Agendamento ──────────────────────────────────────────────────────────

const DIAS_SEMANA = [
  { value: "mon", label: "Segunda-feira" },
  { value: "tue", label: "Terça-feira" },
  { value: "wed", label: "Quarta-feira" },
  { value: "thu", label: "Quinta-feira" },
  { value: "fri", label: "Sexta-feira" },
  { value: "sat", label: "Sábado" },
  { value: "sun", label: "Domingo" },
];

const AGENDAMENTO_KEYS = [
  "smtp_host", "smtp_port", "smtp_user",
  "email_operacional", "email_gestor",
  "cron_dia_semana", "cron_hora", "cron_agendamentos",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</h3>
      <div style={{ display: "grid", gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", alignItems: "start", gap: 12 }}>
      <div>
        <div style={{ fontSize: "0.88rem", color: "var(--text)", fontWeight: 600, marginBottom: 2 }}>{label}</div>
        {hint && <div style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

type AgendamentoEntry = { dia: string; hora: string };

function TabAgendamento() {
  const [vals, setVals]           = useState<Record<string, string>>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);
  const [saved, setSaved]         = useState<string | null>(null);
  const [agendamentos, setAgendamentos] = useState<AgendamentoEntry[]>([{ dia: "mon", hora: "08:00" }]);
  const [savingAg, setSavingAg]   = useState(false);
  const [savedAg, setSavedAg]     = useState(false);

  useEffect(() => {
    ParametrosService.getAll().then(items => {
      const map: Record<string, string> = {};
      items.forEach(p => { if (AGENDAMENTO_KEYS.includes(p.chave)) map[p.chave] = p.valor; });
      setVals(map);

      const agRaw = map["cron_agendamentos"];
      if (agRaw) {
        try {
          const parsed = JSON.parse(agRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAgendamentos(parsed as AgendamentoEntry[]);
            return;
          }
        } catch { /* continua para fallback */ }
      }
      // fallback para parâmetros legados
      if (map["cron_dia_semana"]) {
        setAgendamentos([{ dia: map["cron_dia_semana"], hora: map["cron_hora"] ?? "08:00" }]);
      }
    }).finally(() => setLoading(false));
  }, []);

  async function salvar(chave: string, valor: string) {
    setSaving(chave);
    setSaved(null);
    try {
      await ParametrosService.update(chave, valor);
      setVals(prev => ({ ...prev, [chave]: valor }));
      setSaved(chave);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      alert("Erro ao salvar.");
    } finally {
      setSaving(null);
    }
  }

  async function salvarAgendamentos() {
    setSavingAg(true);
    try {
      await ParametrosService.update("cron_agendamentos", JSON.stringify(agendamentos));
      setSavedAg(true);
      setTimeout(() => setSavedAg(false), 2500);
    } catch {
      alert("Erro ao salvar agendamentos.");
    } finally {
      setSavingAg(false);
    }
  }

  function updateEntry(idx: number, field: "dia" | "hora", value: string) {
    setAgendamentos(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function addEntry() {
    setAgendamentos(prev => [...prev, { dia: "mon", hora: "08:00" }]);
  }

  function removeEntry(idx: number) {
    setAgendamentos(prev => prev.filter((_, i) => i !== idx));
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ maxWidth: 640 }}>
      <Section title="SMTP — Servidor de e-mail">
        <Field label="Servidor (smtp_host)" hint="Ex: smtp.gmail.com">
          <SaveInput chave="smtp_host" value={vals["smtp_host"] ?? ""} onSave={salvar} saving={saving} saved={saved} placeholder="smtp.gmail.com" />
        </Field>
        <Field label="Porta (smtp_port)">
          <SaveInput chave="smtp_port" value={vals["smtp_port"] ?? "587"} onSave={salvar} saving={saving} saved={saved} placeholder="587" />
        </Field>
        <Field label="Usuário (smtp_user)" hint="E-mail que faz o envio">
          <SaveInput chave="smtp_user" value={vals["smtp_user"] ?? ""} onSave={salvar} saving={saving} saved={saved} placeholder="usuario@empresa.com.br" />
        </Field>
        <Field label="Senha (SMTP_PASSWORD)" hint="Configurar via variável de ambiente no .env do backend">
          <div style={{ fontSize: "0.83rem", color: "var(--muted)", padding: "8px 0" }}>
            Defina <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4 }}>SMTP_PASSWORD=sua_senha</code> no arquivo <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4 }}>backend/.env</code> e reinicie o backend.
          </div>
        </Field>
      </Section>

      <Section title="Destinatários">
        <Field label="E-mail operacional" hint="Recebe o Excel de OC para importar no ERP">
          <SaveInput chave="email_operacional" value={vals["email_operacional"] ?? ""} onSave={salvar} saving={saving} saved={saved} placeholder="operador@empresa.com.br" />
        </Field>
        <Field label="E-mail gestor" hint="Recebe o dashboard executivo com valor estimado">
          <SaveInput chave="email_gestor" value={vals["email_gestor"] ?? ""} onSave={salvar} saving={saving} saved={saved} placeholder="gestor@empresa.com.br" />
        </Field>
      </Section>

      <Section title="Agendamento automático">
        <div style={{ display: "grid", gap: 8 }}>
          {agendamentos.map((ag, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                className="filter-select"
                value={ag.dia}
                onChange={e => updateEntry(idx, "dia", e.target.value)}
                style={{ minWidth: 160 }}
              >
                {DIAS_SEMANA.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <input
                type="time"
                className="form-input"
                value={ag.hora}
                onChange={e => updateEntry(idx, "hora", e.target.value)}
                style={{ width: 110 }}
              />
              {agendamentos.length > 1 && (
                <button
                  className="btn-ghost"
                  style={{ color: "var(--danger)", fontSize: "0.82rem", padding: "4px 8px" }}
                  onClick={() => removeEntry(idx)}
                  title="Remover este agendamento"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <button
            className="btn-ghost"
            style={{ fontSize: "0.82rem" }}
            onClick={addEntry}
          >
            + Adicionar horário
          </button>
          <button
            className="btn-primary btn-sm"
            onClick={salvarAgendamentos}
            disabled={savingAg}
          >
            {savingAg ? "Salvando..." : savedAg ? "✓ Salvo" : "Salvar agendamentos"}
          </button>
        </div>

        <div style={{ padding: "10px 14px", background: "rgba(255,193,7,0.08)", border: "1px solid rgba(255,193,7,0.3)", borderRadius: 6, fontSize: "0.82rem", color: "var(--muted)" }}>
          ⚠️ Alterações no agendamento só têm efeito após reiniciar o backend (o cron é lido na inicialização).
        </div>
      </Section>
    </div>
  );
}

function SaveInput({
  chave, value, onSave, saving, saved, placeholder,
}: {
  chave: string; value: string; onSave: (k: string, v: string) => void;
  saving: string | null; saved: string | null; placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const dirty = local !== value;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        className="form-input"
        style={{ flex: 1 }}
        value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => { if (e.key === "Enter") onSave(chave, local); }}
      />
      <button
        className="btn-primary btn-sm"
        onClick={() => onSave(chave, local)}
        disabled={saving === chave || !dirty}
        style={{ minWidth: 64 }}
      >
        {saving === chave ? "..." : saved === chave ? "✓" : "Salvar"}
      </button>
    </div>
  );
}
