import { useState, useEffect } from "react";
import { DashboardService } from "../../services/DashboardService";
import { Semaforo } from "../../components/Semaforo";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { DashboardStats } from "../../types";

export function DashboardPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    DashboardService.getStats()
      .then(setStats)
      .catch(() => setError("Erro ao carregar dados do dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><LoadingSpinner /></div>;
  if (error || !stats) return <div className="page"><p className="error-text">{error}</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do estoque</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        <div className="stat-card" style={{ borderTop: "3px solid #ef4444" }}>
          <p className="stat-value" style={{ color: "#ef4444" }}>{stats.insumos_abaixo_minimo}</p>
          <p className="stat-label">Insumos abaixo do mínimo</p>
        </div>
        <div className="stat-card" style={{ borderTop: "3px solid #eab308" }}>
          <p className="stat-value" style={{ color: "#eab308" }}>{stats.ferramentas_criticas}</p>
          <p className="stat-label">Ferramentas em alerta/crítico</p>
        </div>
        <div className="stat-card" style={{ borderTop: "3px solid #0ea5e9" }}>
          <p className="stat-value" style={{ color: "#0ea5e9" }}>{stats.ocs_geradas_hoje}</p>
          <p className="stat-label">OCs geradas hoje</p>
        </div>
      </div>

      <div className="table-card">
        <h2 style={{ color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 600, marginBottom: 14 }}>
          Alertas prioritários
        </h2>
        {stats.alertas.length === 0 ? (
          <p className="empty-state">Nenhum alerta no momento.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Situação</th>
                <th>CPD</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Estoque atual</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {stats.alertas.map(a => (
                <tr key={`${a.tipo}-${a.cpd}`}>
                  <td><Semaforo situacao={a.situacao} label /></td>
                  <td><code style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{a.cpd}</code></td>
                  <td>{a.descricao || "—"}</td>
                  <td>
                    <span className={`badge ${a.tipo === "insumo" ? "badge-blue" : "badge-purple"}`}>
                      {a.tipo}
                    </span>
                  </td>
                  <td>{a.estoque_atual.toFixed(2)}</td>
                  <td>{a.estoque_minimo.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
