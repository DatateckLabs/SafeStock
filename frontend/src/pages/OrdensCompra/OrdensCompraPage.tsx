import { useState, useEffect } from "react";
import { OrdensCompraService } from "../../services/OrdensCompraService";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { OrdemCompraGerada } from "../../types";

type ActionState = "idle" | "processing" | "done" | "error";

export function OrdensCompraPage() {
  const [locais, setLocais]     = useState<OrdemCompraGerada[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [actionInsumos, setActionInsumos]       = useState<ActionState>("idle");
  const [actionFerramentas, setActionFerramentas] = useState<ActionState>("idle");
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    OrdensCompraService.getAll()
      .then(r => setLocais(r.locais))
      .catch(() => setError("Erro ao carregar ordens de compra."))
      .finally(() => setLoading(false));
  }

  async function gerarInsumos() {
    setActionInsumos("processing");
    setLastResult(null);
    try {
      const r = await OrdensCompraService.gerarInsumos();
      setLastResult(`✔ ${r.mensagem}`);
      setActionInsumos("done");
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLastResult(`✗ ${msg || "Erro ao gerar OC de insumos."}`);
      setActionInsumos("error");
    }
  }

  async function gerarFerramentas() {
    setActionFerramentas("processing");
    setLastResult(null);
    try {
      const r = await OrdensCompraService.gerarFerramentas();
      setLastResult(`✔ ${r.mensagem}`);
      setActionFerramentas("done");
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLastResult(`✗ ${msg || "Erro ao gerar OC de ferramentas."}`);
      setActionFerramentas("error");
    }
  }

  const statusColor = (s: string) =>
    s === "enviada" ? "#22c55e" : s === "erro" ? "#ef4444" : "#eab308";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ordens de Compra</h1>
          <p className="page-subtitle">Histórico e geração de OCs</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-primary"
            onClick={gerarInsumos}
            disabled={actionInsumos === "processing"}
          >
            {actionInsumos === "processing" ? "Gerando..." : "Gerar OC Insumos"}
          </button>
          <button
            className="btn-accent"
            onClick={gerarFerramentas}
            disabled={actionFerramentas === "processing"}
          >
            {actionFerramentas === "processing" ? "Gerando..." : "Gerar OC Ferramentas"}
          </button>
        </div>
      </div>

      {lastResult && (
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: lastResult.startsWith("✔") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${lastResult.startsWith("✔") ? "#22c55e" : "#ef4444"}`,
          color: lastResult.startsWith("✔") ? "#22c55e" : "#ef4444",
          marginBottom: 16,
          fontSize: "0.88rem",
        }}>
          {lastResult}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Nº OC</th>
                <th>Tipo</th>
                <th>Gerado por</th>
                <th>Data</th>
                <th>E-mail</th>
                <th>Itens</th>
              </tr>
            </thead>
            <tbody>
              {locais.map(oc => (
                <tr key={oc.id}>
                  <td>
                    <span style={{ color: statusColor(oc.status), fontSize: "0.82rem", fontWeight: 600 }}>
                      {oc.status.toUpperCase()}
                    </span>
                    {oc.erro_msg && (
                      <span title={oc.erro_msg} style={{ marginLeft: 4, color: "#ef4444", cursor: "help" }}>⚠</span>
                    )}
                  </td>
                  <td><code style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{oc.numero_oc_interno}</code></td>
                  <td><span className={`badge ${oc.tipo === "insumo" ? "badge-blue" : "badge-purple"}`}>{oc.tipo}</span></td>
                  <td style={{ color: "#94a3b8" }}>{oc.gerado_por_username}</td>
                  <td style={{ color: "#64748b", fontSize: "0.82rem" }}>
                    {new Date(oc.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{oc.email_destinatario || "—"}</td>
                  <td>{oc.itens.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {locais.length === 0 && <p className="empty-state">Nenhuma OC gerada ainda.</p>}
        </div>
      )}
    </div>
  );
}
