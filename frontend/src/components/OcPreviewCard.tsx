import { useState, useEffect } from "react";
import type { PreviewFornecedorOC, PreviewOCResponse } from "../types";
import { LoadingSpinner } from "./LoadingSpinner";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtDate(iso: string): string {
  if (!iso || !iso.includes("-")) return iso ?? "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function FornecedorCard({
  forn,
  defaultOpen,
}: {
  forn: PreviewFornecedorOC;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const itens = forn.itens ?? [];
  const totalQtd = itens.reduce((s, i) => s + i.qtd_sugerida, 0);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--surface2)", cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ flexShrink: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
          {open ? "▾" : "▸"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.9rem" }}>
            {forn.razao_social || "Sem fornecedor"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
            {itens.length} {itens.length === 1 ? "item" : "itens"}
            {" · "}
            {forn.id_fornecedor != null ? (
              <span style={{ color: "var(--success)" }}>ID {forn.id_fornecedor}</span>
            ) : (
              <span style={{ color: "var(--warning)" }}>ID nao encontrado no ERP</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Total qtd</div>
          <div style={{ fontWeight: 600, color: "var(--text)" }}>{fmt(totalQtd)}</div>
        </div>
      </div>

      {open && (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>CPD</th>
                <th>Cod. Fabricante</th>
                <th>Descricao</th>
                <th style={{ textAlign: "right" }}>Est. Atual</th>
                <th style={{ textAlign: "right" }}>Est. Minimo</th>
                <th style={{ textAlign: "right" }}>OCs Abertas</th>
                <th style={{ textAlign: "right" }}>Qtd. Sugerida</th>
                <th style={{ textAlign: "right" }}>MOQ</th>
                <th style={{ textAlign: "right" }}>Entrega Prev.</th>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => (
                <tr key={item.cpd}>
                  <td>
                    <code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{item.cpd}</code>
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                    {item.codigo_fabricante || "—"}
                  </td>
                  <td
                    style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={item.descricao || ""}
                  >
                    {item.descricao || "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{fmt(item.estoque_atual)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(item.estoque_minimo)}</td>
                  <td style={{ textAlign: "right", color: item.ocs_abertas > 0 ? "var(--accent)" : "var(--muted)" }}>
                    {fmt(item.ocs_abertas)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--warning)" }}>
                    {fmt(item.qtd_sugerida)}
                    {item.unidade ? (
                      <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: 4 }}>{item.unidade}</span>
                    ) : null}
                  </td>
                  <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.82rem" }}>
                    {item.moq > 0 ? fmt(item.moq) : "—"}
                  </td>
                  <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.82rem" }}>
                    {fmtDate(item.data_entrega)}
                    {item.data_entrega_ajustada && (
                      <span style={{ display: "block", fontSize: "0.68rem", color: "var(--accent)", letterSpacing: "0.02em" }}>
                        consolidada
                      </span>
                    )}
                    {item.sem_leadtime && (
                      <span style={{ display: "block", fontSize: "0.68rem", color: "var(--warning)", letterSpacing: "0.02em" }}>
                        sem LT
                      </span>
                    )}
                    {item.leadtime_semanas > 0 && !item.data_entrega_ajustada && (
                      <span style={{ color: "var(--text-dim)", fontSize: "0.72rem", display: "block" }}>
                        {item.leadtime_semanas}sem
                      </span>
                    )}
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

export function OcPreviewTab({
  getPreview,
  downloadExcel,
  titulo,
}: {
  getPreview: () => Promise<PreviewOCResponse>;
  downloadExcel: () => Promise<void>;
  titulo: string;
}) {
  const [preview, setPreview]       = useState<PreviewOCResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setLoading(true);
    setError(null);
    getPreview()
      .then(data => setPreview(data))
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(msg || "Erro ao carregar pre-visualizacao.");
      })
      .finally(() => setLoading(false));
  }

  async function exportar() {
    setDownloading(true);
    setLastResult(null);
    try {
      await downloadExcel();
      setLastResult("OK - Excel gerado e baixado.");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLastResult("Erro: " + (msg || "Falha ao gerar Excel."));
    } finally {
      setDownloading(false);
    }
  }

  const totalForn  = preview?.total_fornecedores ?? 0;
  const totalItens = preview?.total_itens ?? 0;

  const semLT = preview?.fornecedores.flatMap(f => f.itens.filter(i => i.sem_leadtime)) ?? [];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn-ghost" onClick={load} style={{ fontSize: "0.82rem" }}>
          Atualizar
        </button>
        <button
          className="btn-primary"
          onClick={exportar}
          disabled={downloading || !preview || totalItens === 0}
          title={`Gera planilha Excel — ${titulo}`}
        >
          {downloading ? "Gerando..." : "Exportar Excel para ERP"}
        </button>
        {lastResult && (
          <span style={{
            fontSize: "0.82rem",
            color: lastResult.startsWith("OK") ? "var(--success)" : "var(--danger)",
          }}>
            {lastResult}
          </span>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid var(--danger)", color: "var(--danger)", fontSize: "0.88rem" }}>
          {error}
        </div>
      ) : preview && preview.fornecedores.length > 0 ? (
        <>
          <div style={{ marginBottom: 16, color: "var(--muted)", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{totalForn}</span>
            {" fornecedor"}{totalForn !== 1 ? "es" : ""}
            {" · "}
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{totalItens}</span>
            {" ite"}{totalItens !== 1 ? "ns" : "m"}
            {" precisam de reposicao"}
          </div>
          {preview.fornecedores.map(forn => (
            <FornecedorCard
              key={forn.razao_social}
              forn={forn}
              defaultOpen={(forn.itens ?? []).length <= 5}
            />
          ))}

          {semLT.length > 0 && (
            <SemLeadtimeAlert itens={semLT} />
          )}
        </>
      ) : (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: "0.9rem" }}>
          Nenhum item precisa de reposicao no momento.
        </div>
      )}
    </div>
  );
}

function SemLeadtimeAlert({ itens }: { itens: { cpd: string; descricao: string | null }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 24, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(245,158,11,0.08)", cursor: "pointer" }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ color: "var(--warning)", fontSize: "0.82rem", fontWeight: 600 }}>
          {open ? "▾" : "▸"} {itens.length} {itens.length === 1 ? "item" : "itens"} sem leadtime cadastrado
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
          (usando prazo padrao de 30 dias — cadastre o leadtime no ERP)
        </span>
      </div>
      {open && (
        <div style={{ padding: "8px 14px 12px" }}>
          <table className="data-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>CPD</th>
                <th>Descricao</th>
              </tr>
            </thead>
            <tbody>
              {itens.map(i => (
                <tr key={i.cpd}>
                  <td><code style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{i.cpd}</code></td>
                  <td style={{ color: "var(--muted)" }}>{i.descricao || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
