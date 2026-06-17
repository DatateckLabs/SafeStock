import { useState, useEffect } from "react";
import type { DisparoLog, DisparoResult } from "../types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

interface Props {
  modulo: "insumos" | "ferramentas";
  descricao: string;
  dispararFn: () => Promise<DisparoResult>;
  getLogFn: () => Promise<DisparoLog[]>;
}

export function DisparoTab({ descricao, dispararFn, getLogFn }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DisparoResult | null>(null);
  const [log, setLog] = useState<DisparoLog[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLogFn()
      .then(setLog)
      .catch(() => {})
      .finally(() => setLogLoading(false));
  }, []);

  async function handleDisparo() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await dispararFn();
      setResult(res);
      const updated = await getLogFn();
      setLog(updated);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao disparar e-mail.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "24px 0" }}>
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
          {descricao}
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
              {result.log.total_fornecedores > 0 && (
                <>
                  <span style={{ color: "var(--muted)" }}>Fornecedores:</span> {result.log.total_fornecedores} &nbsp;|&nbsp;
                  <span style={{ color: "var(--muted)" }}>Itens:</span> {result.log.total_itens}
                  {result.log.valor_total_brl != null && (
                    <> &nbsp;|&nbsp; <span style={{ color: "var(--muted)" }}>Valor estimado:</span> <strong style={{ color: "var(--accent)" }}>{fmtBRL(result.log.valor_total_brl)}</strong></>
                  )}
                  {result.log.cotacao_usd_brl && (
                    <> &nbsp;|&nbsp; <span style={{ color: "var(--muted)" }}>USD/BRL:</span> {result.log.cotacao_usd_brl.toFixed(4)}</>
                  )}
                </>
              )}
              {result.log.erro_msg && (
                <div style={{ color: "var(--danger)", marginTop: 4 }}>{result.log.erro_msg}</div>
              )}
            </div>
          </div>
        )}
      </div>

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
                      padding: "2px 8px", borderRadius: 4, fontSize: "0.78rem", fontWeight: 700,
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
