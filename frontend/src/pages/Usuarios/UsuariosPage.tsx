import { useState, useEffect } from "react";
import { UsuariosService } from "../../services/UsuariosService";
import { Modal } from "../../components/Modal";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { UserProfile } from "../../types";

export function UsuariosPage() {
  const [users, setUsers]     = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState({ username: "", role: "operador" as UserProfile["role"] });
  const [saving, setSaving]   = useState(false);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    UsuariosService.getAll()
      .then(setUsers)
      .catch(() => setError("Erro ao carregar usuários."))
      .finally(() => setLoading(false));
  }

  async function criar() {
    if (!form.username.trim()) return;
    setSaving(true);
    try {
      await UsuariosService.create({ username: form.username.trim(), role: form.role });
      setShowNew(false);
      setForm({ username: "", role: "operador" });
      load();
    } catch {
      alert("Erro ao criar usuário. Verifique se o username já existe.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(u: UserProfile) {
    try {
      const updated = await UsuariosService.update(u.id, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
    } catch { alert("Erro ao atualizar."); }
  }

  async function changeRole(u: UserProfile, role: UserProfile["role"]) {
    try {
      const updated = await UsuariosService.update(u.id, { role });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
    } catch { alert("Erro ao atualizar."); }
  }

  if (loading) return <div className="page"><LoadingSpinner /></div>;
  if (error) return <div className="page"><p className="error-text">{error}</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-subtitle">{users.length} usuário(s) cadastrado(s)</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ Novo Usuário</button>
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr><th>Usuário</th><th>Perfil</th><th>Ativo</th><th>Criado em</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600, color: "var(--text)" }}>{u.username}</td>
                <td>
                  <select
                    className="filter-select"
                    value={u.role}
                    onChange={e => changeRole(u, e.target.value as UserProfile["role"])}
                  >
                    <option value="admin">Admin</option>
                    <option value="gestor">Gestor</option>
                    <option value="operador">Operador</option>
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => toggleAtivo(u)}
                    style={{
                      background: u.is_active ? "rgba(4,213,4,0.12)" : "rgba(239,68,68,0.12)",
                      border: `1px solid ${u.is_active ? "var(--success)" : "var(--danger)"}`,
                      color: u.is_active ? "var(--success)" : "var(--danger)",
                      borderRadius: 6,
                      padding: "3px 10px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {u.is_active ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td>
                  {u.is_active && (
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => { if (confirm("Desativar usuário?")) toggleAtivo(u); }}
                    >
                      Desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="empty-state">Nenhum usuário cadastrado.</p>}
      </div>

      {showNew && (
        <Modal title="Novo Usuário" onClose={() => setShowNew(false)}>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 16 }}>
            O usuário deve existir no auth-service (central ou local) para conseguir fazer login.
          </p>
          <label className="form-label">Username</label>
          <input
            className="form-input"
            type="text"
            placeholder="nome.usuario"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          />
          <label className="form-label" style={{ marginTop: 12 }}>Perfil</label>
          <select
            className="filter-select"
            style={{ width: "100%", padding: "8px 12px" }}
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as UserProfile["role"] }))}
          >
            <option value="operador">Operador</option>
            <option value="gestor">Gestor</option>
            <option value="admin">Admin</option>
          </select>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn-primary" onClick={criar} disabled={saving}>
              {saving ? "Criando..." : "Criar"}
            </button>
            <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
