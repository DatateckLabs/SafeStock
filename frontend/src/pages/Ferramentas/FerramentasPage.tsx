import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FerramentasService } from "../../services/FerramentasService";
import { OrdensCompraService } from "../../services/OrdensCompraService";
import { DisparoService } from "../../services/DisparoService";
import { OcPreviewTab } from "../../components/OcPreviewCard";
import { DisparoTab } from "../../components/DisparoTab";
import { SobreModal, SobreButton } from "../../components/SobreModal";
import type { FerramentaResponse, DrilldownItem, ConsumoMensalItem, SemFerramentaItem } from "../../types";

const _consumoCache         = new Map<string, ConsumoMensalItem[]>();
const _consumoCacheTerminal = new Map<string, ConsumoMensalItem[]>();

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function fmtMesAno(mesAno: string): string {
  const [y, m] = mesAno.split("-");
  return `${MESES_PT[parseInt(m) - 1]}/${y.slice(2)}`;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtData(d: string | null | undefined): string {
  if (!d) return "—";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
  return d.slice(0, 10);
}

function saldoFerramenta(f: FerramentaResponse): number {
  return f.estoque_atual + f.ocs_abertas - f.estoque_minimo_calculado;
}

function sortBySaldoFerramenta(items: FerramentaResponse[]): FerramentaResponse[] {
  return [...items].sort((a, b) => saldoFerramenta(a) - saldoFerramenta(b));
}

function compraSugeridaFerramenta(f: FerramentaResponse): number | null {
  if (f.estoque_minimo_calculado <= 0) return null;
  const needed = Math.max(0, f.estoque_minimo_calculado - f.estoque_atual - f.ocs_abertas);
  if (needed === 0) return null;
  const moq = f.moq > 0 ? f.moq : 1;
  return Math.ceil(needed / moq) * moq;
}

function SaldoCell({ value }: { value: number }) {
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

// ─── Tooltip consumo mensal ───────────────────────────────────────────────────

function ConsumoTooltip({
  consumo_mensal,
  consumo_historico_mensal,
  consumo_pendente_mensal,
  janela_meses,
  janela_dias,
  produzido_raw,
  pendente_raw,
  cpd_ferramenta,
  cpd_terminal,
  leadtime_meses_calc,
  cobertura_meses,
  usa_cobertura_padrao,
  aplicacoes,
  consumo_ferramenta_mensal,
  estoque_minimo_calculado,
}: {
  consumo_mensal: number;
  consumo_historico_mensal: number;
  consumo_pendente_mensal: number;
  janela_meses?: number;
  janela_dias?: number;
  produzido_raw?: number;
  pendente_raw?: number;
  cpd_ferramenta?: string;
  cpd_terminal?: string;
  leadtime_meses_calc?: number;
  cobertura_meses?: number;
  usa_cobertura_padrao?: boolean;
  aplicacoes?: number;
  consumo_ferramenta_mensal?: number;
  estoque_minimo_calculado?: number;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [pos, setPos]           = useState<{ x: number; y: number } | null>(null);
  const [mensais, setMensais]   = useState<ConsumoMensalItem[] | null>(null);
  const [loadingM, setLoadingM] = useState(false);

  const jMeses = janela_meses ?? 0;
  const jDias  = janela_dias  ?? Math.round(jMeses * 30);
  const label  = jMeses > 0 ? `${Math.round(jMeses)} meses (${jDias} dias)` : "janela global";

  function cancelClose() {
    if (closeTimer.current !== null) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }
  function scheduleClose() {
    closeTimer.current = window.setTimeout(() => setPos(null), 150);
  }
  function handleMouseEnter() {
    cancelClose();
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(rect.left + rect.width / 2, 200), window.innerWidth - 200);
    const openAbove = rect.top > 350;
    setPos({ x, y: openAbove ? rect.top - 8 : rect.bottom + 8 });

    if (!mensais && !loadingM) {
      if (cpd_ferramenta) {
        if (_consumoCache.has(cpd_ferramenta)) {
          setMensais(_consumoCache.get(cpd_ferramenta)!);
        } else {
          setLoadingM(true);
          FerramentasService.getConsumoMensal(cpd_ferramenta)
            .then(data => { _consumoCache.set(cpd_ferramenta, data); setMensais(data); })
            .finally(() => setLoadingM(false));
        }
      } else if (cpd_terminal) {
        if (_consumoCacheTerminal.has(cpd_terminal)) {
          setMensais(_consumoCacheTerminal.get(cpd_terminal)!);
        } else {
          setLoadingM(true);
          FerramentasService.getConsumoMensalTerminal(cpd_terminal)
            .then(data => { _consumoCacheTerminal.set(cpd_terminal, data); setMensais(data); })
            .finally(() => setLoadingM(false));
        }
      }
    }
  }

  const openAbove = pos ? pos.y > 350 : true;
  const tooltip = pos ? (
    <div
      style={{ position: "fixed", left: pos.x, ...(openAbove ? { top: pos.y } : { top: pos.y }), transform: openAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", zIndex: 9999, fontSize: "0.78rem", color: "var(--text)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", width: 380, pointerEvents: "auto" }}
      onMouseEnter={cancelClose}
      onMouseLeave={() => setPos(null)}
    >
      <div style={{ color: "var(--muted)", fontSize: "0.68rem", marginBottom: 8, letterSpacing: "0.06em" }}>
        CONSUMO MENSAL · {label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ color: "var(--muted)" }}>Historico (produzido)</span>
        <span>{fmt(consumo_historico_mensal)}/mes</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ color: "var(--warning)" }}>Pendente (OPs futuras)</span>
        <span style={{ color: "var(--warning)" }}>{fmt(consumo_pendente_mensal)}/mes</span>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 7, display: "flex", justifyContent: "space-between", fontWeight: 600, marginBottom: 10 }}>
        <span>Total</span>
        <span>{fmt(consumo_mensal)}/mes</span>
      </div>
      {produzido_raw !== undefined && (
        <>
          <div style={{ color: "var(--muted)", fontSize: "0.68rem", marginBottom: 6, letterSpacing: "0.06em", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            ACUMULADO NA JANELA (bruto BQ)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "var(--muted)" }}>Produzido total</span>
            <span>{fmt(produzido_raw)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: "var(--warning)" }}>Pendente total</span>
            <span style={{ color: "var(--warning)" }}>{fmt(pendente_raw ?? 0)}</span>
          </div>
        </>
      )}
      {(cpd_ferramenta || cpd_terminal) && (
        <>
          <div style={{ color: "var(--muted)", fontSize: "0.68rem", marginBottom: 6, letterSpacing: "0.06em", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            DISTRIBUICAO POR MES
          </div>
          {loadingM ? (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>carregando...</div>
          ) : mensais && mensais.length > 0 ? (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                <thead>
                  <tr style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "2px 4px", fontWeight: 400 }}>Mes</th>
                    <th style={{ textAlign: "right", padding: "2px 4px", fontWeight: 400 }}>Produzido</th>
                    <th style={{ textAlign: "right", padding: "2px 4px", fontWeight: 400 }}>Pendente</th>
                  </tr>
                </thead>
                <tbody>
                  {mensais.map(m => (
                    <tr key={m.mes_ano} style={{ borderBottom: "1px solid var(--surface2)" }}>
                      <td style={{ padding: "3px 4px", color: "var(--muted)" }}>{fmtMesAno(m.mes_ano)}</td>
                      <td style={{ padding: "3px 4px", textAlign: "right", color: m.produzido > 0 ? "var(--text)" : "var(--text-dim)" }}>
                        {m.produzido > 0 ? fmt(m.produzido) : "—"}
                      </td>
                      <td style={{ padding: "3px 4px", textAlign: "right", color: m.pendente > 0 ? "var(--warning)" : "var(--text-dim)" }}>
                        {m.pendente > 0 ? fmt(m.pendente) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : mensais ? (
            <div style={{ color: "var(--muted)", fontSize: "0.73rem" }}>Sem dados no periodo.</div>
          ) : null}
        </>
      )}

      {/* Memória de cálculo do estoque mínimo — só aparece para ferramentas (cpd_ferramenta) */}
      {cpd_ferramenta && aplicacoes != null && leadtime_meses_calc != null && (
        <>
          <div style={{ color: "var(--muted)", fontSize: "0.68rem", marginBottom: 6, letterSpacing: "0.06em", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            CALCULO EST. MINIMO
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "var(--muted)" }}>Durabilidade</span>
            <span>{aplicacoes.toLocaleString("pt-BR")} term./un.</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "var(--muted)" }}>Leadtime usado</span>
            <span>{leadtime_meses_calc.toFixed(2)} meses</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "var(--muted)" }}>Cobertura seguranca</span>
            <span>
              {(cobertura_meses ?? 0).toFixed(1)} meses
              {usa_cobertura_padrao && <span style={{ color: "var(--warning)", fontSize: "0.7rem", marginLeft: 4 }}>(padrao global)</span>}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "var(--muted)" }}>Consumo ferramenta</span>
            <span>{(consumo_ferramenta_mensal ?? 0).toFixed(4)} un./mes</span>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
            <span style={{ color: "var(--warning)" }}>Est. Minimo</span>
            <span style={{ color: "var(--warning)" }}>
              {(estoque_minimo_calculado ?? 0).toFixed(4)} un.
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.7rem", marginLeft: 4 }}>
                = {(consumo_ferramenta_mensal ?? 0).toFixed(4)} × ({leadtime_meses_calc.toFixed(2)} + {(cobertura_meses ?? 0).toFixed(1)})
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <div ref={triggerRef} style={{ display: "inline-block", cursor: "help" }} onMouseEnter={handleMouseEnter} onMouseLeave={scheduleClose}>
      <span style={{ borderBottom: "1px dashed #475569" }}>{fmt(consumo_mensal)}</span>
      {tooltip && createPortal(tooltip, document.body)}
    </div>
  );
}

// ─── Sem Config tab ───────────────────────────────────────────────────────────

function exportarSemFerramentaXlsx(items: SemFerramentaItem[]) {
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

  const header = ["Subgrupo", "CPD", "Descrição", "Cód. Fabricante", "Consumo/mês", "Histórico/mês", "Pendente/mês", "Meses janela"];
  const rows = items.map(i => [
    i.subgrupo || "Sem Subgrupo",
    i.cpd_materia_prima,
    i.descricao || "",
    i.codigo_fabricante || "",
    num(i.consumo_mensal),
    num(i.consumo_historico_mensal),
    num(i.consumo_pendente_mensal),
    i.janela_meses,
  ]);

  const thStyle = "background:#1a1a1a;color:#04d504;font-weight:bold;padding:6px 10px;border:1px solid #333;white-space:nowrap";
  const tdStyle = "padding:5px 10px;border:1px solid #ddd;";

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Ferr. Pendentes</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>
<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:12px">
<thead><tr>${header.map(h => `<th style="${thStyle}">${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((r, ri) => `<tr style="background:${ri % 2 === 0 ? "#fff" : "#f5f5f5"}">${r.map(c => `<td style="${tdStyle}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
</table></body></html>`;

  const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `ferr_pendentes_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

function SemConfigTab({ items, loading }: { items: FerramentaResponse[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Ferramentas com demanda mas sem configuração explícita (usando defaults globais)
  const pendentes = items.filter(i => {
    if (i.consumo_mensal <= 0) return false;
    return i.usa_cobertura_padrao || i.leadtime_meses_calc === 0;
  });

  // Agrupa por fornecedor
  const byForn = new Map<string, FerramentaResponse[]>();
  for (const item of pendentes) {
    const forn = item.razao_social_fornecedor || "SEM FORNECEDOR CADASTRADO";
    if (!byForn.has(forn)) byForn.set(forn, []);
    byForn.get(forn)!.push(item);
  }

  const filtered = search
    ? Array.from(byForn.entries()).filter(([forn, its]) =>
        forn.toLowerCase().includes(search.toLowerCase()) ||
        its.some(i => i.cpd_ferramenta.toLowerCase().includes(search.toLowerCase()) ||
                      (i.descricao || "").toLowerCase().includes(search.toLowerCase()))
      )
    : Array.from(byForn.entries());

  const totalFerramentas = filtered.reduce((s, [, its]) => s + its.length, 0);

  function toggleForn(forn: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(forn) ? next.delete(forn) : next.add(forn);
      return next;
    });
  }

  if (loading) return <div style={{ padding: 32, color: "var(--muted)" }}>Carregando...</div>;

  if (pendentes.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--success)", padding: "48px 0", fontSize: "0.9rem" }}>
        Todos os fornecedores com demanda estao configurados.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input
          className="search-input"
          style={{ marginBottom: 0, flex: 1, maxWidth: 360 }}
          placeholder="Buscar fornecedor ou CPD..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          {filtered.length} fornecedores · {totalFerramentas} ferramentas pendentes
        </span>
      </div>

      <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", fontSize: "0.82rem", color: "var(--warning)" }}>
        Ferramentas com consumo mas sem configuracao explícita de fornecedor.
        O calculo usa <strong>cobertura padrao de 2 meses</strong> como fallback — configure em <strong>Cadastros &rarr; Fornecedores</strong> para ajustar por fornecedor.
      </div>

      {filtered.map(([forn, its]) => {
        const isOpen = expanded.has(forn);
        const semCobertura = its.some(i => i.usa_cobertura_padrao);
        const semLeadtime  = its.some(i => i.leadtime_meses_calc === 0);
        const totalConsumo = its.reduce((s, i) => s + i.consumo_mensal, 0);

        return (
          <div key={forn} style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--surface2)", cursor: "pointer" }}
              onClick={() => toggleForn(forn)}
            >
              <span style={{ color: "var(--muted)", fontSize: "0.9rem", flexShrink: 0 }}>
                {isOpen ? "▾" : "▸"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.88rem" }}>{forn}</div>
                <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: 3, display: "flex", gap: 8 }}>
                  <span>{its.length} {its.length === 1 ? "ferramenta" : "ferramentas"}</span>
                  {semCobertura && (
                    <span style={{ background: "rgba(239,68,68,0.15)", color: "var(--danger)", borderRadius: 4, padding: "1px 6px" }}>
                      sem cobertura
                    </span>
                  )}
                  {semLeadtime && (
                    <span style={{ background: "rgba(245,158,11,0.15)", color: "var(--warning)", borderRadius: 4, padding: "1px 6px" }}>
                      sem leadtime
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Consumo total</div>
                <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.88rem" }}>
                  {totalConsumo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} term./mes
                </div>
              </div>
            </div>

            {isOpen && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>CPD</th>
                      <th>Descricao</th>
                      <th style={{ textAlign: "right" }}>Consumo/mes (term.)</th>
                      <th style={{ textAlign: "right" }}>LT BQ (sem.)</th>
                      <th style={{ textAlign: "right" }}>Durabilidade</th>
                      <th>O que falta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {its.map(item => {
                      const faltaCobertura = item.usa_cobertura_padrao;
                      const faltaLeadtime  = item.leadtime_meses_calc === 0;
                      return (
                        <tr key={item.cpd_ferramenta}>
                          <td>
                            <code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{item.cpd_ferramenta}</code>
                          </td>
                          <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.descricao || ""}>
                            {item.descricao || "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {item.consumo_mensal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ textAlign: "right", color: item.leadtime_semanas > 0 ? "var(--text)" : "var(--muted)" }}>
                            {item.leadtime_semanas > 0 ? item.leadtime_semanas : "—"}
                          </td>
                          <td style={{ textAlign: "right", color: item.aplicacoes === 80000 ? "var(--warning)" : "var(--text)" }}
                              title={item.aplicacoes === 80000 ? "Usando padrao de 80.000 — configure em Cadastros se diferente" : undefined}>
                            {item.aplicacoes.toLocaleString("pt-BR")}
                            {item.aplicacoes === 80000 && <span style={{ fontSize: "0.7rem", marginLeft: 4 }}>*</span>}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {faltaCobertura && (
                                <span style={{ fontSize: "0.72rem", background: "rgba(239,68,68,0.12)", color: "var(--danger)", borderRadius: 4, padding: "2px 6px" }}>
                                  Cobertura: padrao 2m (Cadastros)
                                </span>
                              )}
                              {faltaLeadtime && (
                                <span style={{ fontSize: "0.72rem", background: "rgba(245,158,11,0.12)", color: "var(--warning)", borderRadius: 4, padding: "2px 6px" }}>
                                  Leadtime (BQ ou override)
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Ferramentas lista ────────────────────────────────────────────────────────

function FerramentasListTab({
  items, loading, error,
}: {
  items: FerramentaResponse[];
  loading: boolean;
  error: string | null;
}) {
  const [search, setSearch]     = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drillMap, setDrillMap] = useState<Record<string, DrilldownItem[]>>({});
  const [drilling, setDrilling] = useState<string | null>(null);

  function toggle(cpd: string) {
    if (expanded === cpd) { setExpanded(null); return; }
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
          placeholder="Buscar por CPD ou descricao..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          {loading ? "…" : `${filtered.length} ferramentas`}
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th style={{ width: 72 }}>CPD</th>
              <th>Cód. Fabricante</th>
              <th style={{ textAlign: "right", width: 60 }}>Term.</th>
              <th style={{ textAlign: "right", width: 100 }}>Consumo/mês</th>
              <th style={{ textAlign: "right", width: 90 }}>Est. Mín.</th>
              <th style={{ textAlign: "right", width: 70 }}>OCs</th>
              <th style={{ textAlign: "right", width: 90 }}>Est. Atual</th>
              <th style={{ textAlign: "right", width: 80, whiteSpace: "nowrap" }}>Inventário</th>
              <th style={{ textAlign: "right", width: 90 }}>Saldo</th>
              <th style={{ textAlign: "right", width: 90 }}>OC Sug.</th>
              <th style={{ textAlign: "right", width: 110 }}>Valor OC</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
              : filtered.flatMap(item => {
                  const saldo   = saldoFerramenta(item);
                  const ocSug   = compraSugeridaFerramenta(item);
                  const isOpen  = expanded === item.cpd_ferramenta;
                  const drill  = drillMap[item.cpd_ferramenta];
                  const isLoading = drilling === item.cpd_ferramenta;

                  const mainRow = (
                    <tr
                      key={item.cpd_ferramenta}
                      style={{ cursor: "pointer", background: isOpen ? "var(--surface2)" : undefined }}
                      onClick={() => toggle(item.cpd_ferramenta)}
                    >
                      <td style={{ textAlign: "center" }}>
                        <button className="expand-btn" tabIndex={-1}>
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>
                      <td>
                        <code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{item.cpd_ferramenta}</code>
                      </td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={item.descricao || undefined}>
                        {item.codigo_fabricante || item.descricao || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: item.num_terminais > 20 ? "var(--warning)" : "var(--muted)",
                            fontWeight: item.num_terminais > 20 ? 600 : 400,
                          }}
                          title={`${item.num_terminais} terminais (CPDs) mapeados para esta ferramenta no ToolGuard`}
                        >
                          {item.num_terminais}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }} onClick={e => e.stopPropagation()}>
                        <ConsumoTooltip
                          consumo_mensal={item.consumo_mensal}
                          consumo_historico_mensal={item.consumo_historico_mensal}
                          consumo_pendente_mensal={item.consumo_pendente_mensal}
                          janela_meses={item.janela_meses}
                          janela_dias={item.janela_dias}
                          produzido_raw={item.produzido_total}
                          pendente_raw={item.pendente_total}
                          cpd_ferramenta={item.cpd_ferramenta}
                          leadtime_meses_calc={item.leadtime_meses_calc}
                          cobertura_meses={item.cobertura_meses}
                          usa_cobertura_padrao={item.usa_cobertura_padrao}
                          aplicacoes={item.aplicacoes}
                          consumo_ferramenta_mensal={item.consumo_ferramenta_mensal}
                          estoque_minimo_calculado={item.estoque_minimo_calculado}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {item.estoque_minimo_calculado > 0 ? (
                          <span title={`Durabilidade: ${item.aplicacoes.toLocaleString("pt-BR")} · LT: ${item.leadtime_meses_calc.toFixed(2)}m · Cobertura: ${item.cobertura_meses}m${item.usa_cobertura_padrao ? " (padrao)" : ""}`}>
                            {item.estoque_minimo_calculado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            {item.usa_cobertura_padrao && (
                              <span style={{ marginLeft: 4, fontSize: "0.68rem", color: "var(--warning)", opacity: 0.7 }}>~</span>
                            )}
                          </span>
                        ) : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right", color: item.ocs_abertas > 0 ? "var(--accent)" : "var(--muted)" }}>
                        {fmt(item.ocs_abertas)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(item.estoque_atual)}</td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {fmtData(item.data_ultimo_inventario)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <SaldoCell value={saldo} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {ocSug != null ? (
                          <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                            {ocSug.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {ocSug != null && item.preco_compra > 0 ? (
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>
                            <span style={{ color: "var(--muted)", fontWeight: 400, marginRight: 2, fontSize: "0.75rem" }}>
                              {(item.moeda || "BRL").toUpperCase() === "USD" ? "US$" : "R$"}
                            </span>
                            {(ocSug * item.preco_compra).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );

                  if (!isOpen) return [mainRow];

                  const drillRow = (
                    <tr key={`drill-${item.cpd_ferramenta}`} className="drill-row">
                      <td colSpan={11}>
                        <div className="drill-inner">
                          {isLoading ? (
                            <p style={{ color: "var(--muted)", padding: "10px 0", fontSize: "0.83rem" }}>Carregando terminais...</p>
                          ) : !drill || drill.length === 0 ? (
                            <p style={{ color: "var(--muted)", padding: "10px 0", fontSize: "0.83rem" }}>Nenhuma OP pendente encontrada.</p>
                          ) : (
                            <table className="drill-table">
                              <thead>
                                <tr>
                                  <th>Terminal (CPD)</th>
                                  <th>Cod. Fabricante</th>
                                  <th>Descricao</th>
                                  <th style={{ textAlign: "right" }}>OPs Pendentes</th>
                                  <th style={{ textAlign: "right" }}>Consumo Mensal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {drill.map(d => (
                                  <tr key={d.cpd_materia_prima}>
                                    <td><code style={{ fontSize: "0.78rem" }}>{d.cpd_materia_prima}</code></td>
                                    <td style={{ color: "var(--muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{d.codigo_fabricante || "—"}</td>
                                    <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.descricao || "—"}</td>
                                    <td style={{ textAlign: "right" }}>{fmt(d.ops_pendentes)}</td>
                                    <td style={{ textAlign: "right" }}>
                                      <ConsumoTooltip
                                        consumo_mensal={d.consumo_mensal_ferramenta}
                                        consumo_historico_mensal={d.consumo_historico_mensal}
                                        consumo_pendente_mensal={d.consumo_pendente_mensal}
                                        janela_meses={d.janela_meses}
                                        produzido_raw={d.produzido_raw}
                                        pendente_raw={d.ops_pendentes}
                                        cpd_terminal={d.cpd_materia_prima}
                                      />
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

// ─── Sem Ferramenta ───────────────────────────────────────────────────────────

function SemFerramentaTab() {
  const [items, setItems]         = useState<SemFerramentaItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    FerramentasService.getSemFerramenta()
      .then(data => {
        setItems(data);
        setCollapsed(new Set(data.map(i => i.subgrupo || "Sem Subgrupo")));
      })
      .catch(() => setError("Erro ao carregar materiais sem ferramenta."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(
    i =>
      i.cpd_materia_prima.toLowerCase().includes(search.toLowerCase()) ||
      (i.codigo_fabricante || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.descricao || "").toLowerCase().includes(search.toLowerCase())
  );

  const groups: { subgrupo: string; itens: SemFerramentaItem[] }[] = [];
  const seen = new Map<string, SemFerramentaItem[]>();
  for (const item of filtered) {
    const sg = item.subgrupo || "Sem Subgrupo";
    if (!seen.has(sg)) { seen.set(sg, []); groups.push({ subgrupo: sg, itens: seen.get(sg)! }); }
    seen.get(sg)!.push(item);
  }

  function toggleGroup(sg: string) {
    setCollapsed(prev => { const next = new Set(prev); next.has(sg) ? next.delete(sg) : next.add(sg); return next; });
  }
  function toggleAll(collapseAll: boolean) {
    setCollapsed(collapseAll ? new Set(groups.map(g => g.subgrupo)) : new Set());
  }
  const allCollapsed = groups.length > 0 && collapsed.size === groups.length;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input
          className="search-input"
          style={{ marginBottom: 0, flex: 1, maxWidth: 360 }}
          placeholder="Buscar por CPD, descricao ou subgrupo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {!loading && groups.length > 0 && (
          <button className="btn-ghost" style={{ fontSize: "0.78rem", padding: "4px 10px" }} onClick={() => toggleAll(!allCollapsed)}>
            {allCollapsed ? "Expandir todos" : "Recolher todos"}
          </button>
        )}
        <span style={{ color: "var(--muted)", fontSize: "0.82rem", flex: 1 }}>
          {loading ? "…" : `${filtered.length} materiais · ${groups.length} subgrupos`}
        </span>
        {!loading && filtered.length > 0 && (
          <button
            className="btn-ghost"
            style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}
            onClick={() => exportarSemFerramentaXlsx(filtered)}
            title={search ? `Exportar ${filtered.length} itens filtrados` : "Exportar todos para Excel"}
          >
            ↓ Exportar Excel {search ? `(${filtered.length})` : ""}
          </button>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              <th>CPD</th>
              <th>Cód. Fabricante</th>
              <th>Descrição</th>
              <th style={{ textAlign: "right" }}>Consumo Mensal</th>
              <th style={{ textAlign: "right" }}>Historico/mes</th>
              <th style={{ textAlign: "right" }}>Pendente/mes</th>
              <th style={{ textAlign: "right" }}>Meses</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              : groups.flatMap(({ subgrupo, itens }) => {
                  const isOpen = !collapsed.has(subgrupo);
                  const totalConsumo = itens.reduce((s, i) => s + i.consumo_mensal, 0);
                  const headerRow = (
                    <tr key={`sg-${subgrupo}`} style={{ cursor: "pointer", background: "var(--surface2)" }} onClick={() => toggleGroup(subgrupo)}>
                      <td style={{ textAlign: "center", paddingLeft: 8 }}>
                        <button className="expand-btn" tabIndex={-1}>{isOpen ? "▾" : "▸"}</button>
                      </td>
                      <td colSpan={3} style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.82rem", letterSpacing: "0.03em" }}>
                        {subgrupo}
                        <span style={{ marginLeft: 10, color: "var(--muted)", fontWeight: 400, fontSize: "0.77rem" }}>
                          {itens.length} {itens.length === 1 ? "item" : "itens"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.82rem", fontWeight: 600 }}>
                        {fmt(totalConsumo)}/mes
                      </td>
                      <td colSpan={3} />
                    </tr>
                  );
                  if (!isOpen) return [headerRow];
                  const itemRows = itens.map(item => (
                    <tr key={item.cpd_materia_prima}>
                      <td />
                      <td><code style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{item.cpd_materia_prima}</code></td>
                      <td style={{ fontSize: "0.82rem" }}>{item.codigo_fabricante || "—"}</td>
                      <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.82rem", color: "var(--muted)" }}
                          title={item.descricao || undefined}>
                        {item.descricao || "—"}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>
                        <ConsumoTooltip
                          consumo_mensal={item.consumo_mensal}
                          consumo_historico_mensal={item.consumo_historico_mensal}
                          consumo_pendente_mensal={item.consumo_pendente_mensal}
                          janela_meses={item.janela_meses}
                          produzido_raw={item.produzido_total}
                          pendente_raw={item.pendente_total}
                        />
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>{fmt(item.consumo_historico_mensal)}</td>
                      <td style={{ textAlign: "right", color: "var(--warning)" }}>
                        {item.consumo_pendente_mensal > 0 ? fmt(item.consumo_pendente_mensal) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.82rem" }}>
                        {Math.round(item.janela_meses)}
                      </td>
                    </tr>
                  ));
                  return [headerRow, ...itemRows];
                })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <p className="empty-state">Nenhum material sem ferramenta encontrado.</p>
        )}
      </div>
    </>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

type TabId = "lista" | "sem-config" | "sem-ferramenta" | "oc-ferramentas" | "disparo";

export function FerramentasPage() {
  const [tab, setTab]       = useState<TabId>("lista");
  const [showSobre, setShowSobre] = useState(false);
  const [items, setItems]   = useState<FerramentaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    setLoading(true);
    setError(null);
    FerramentasService.getAll()
      .then(setItems)
      .catch(() => setError("Erro ao carregar ferramentas."))
      .finally(() => setLoading(false));
  }

  // Conta ferramentas sem configuração explícita para badge na aba
  const semConfigCount = items.filter(
    i => i.consumo_mensal > 0 && (i.usa_cobertura_padrao || i.leadtime_meses_calc === 0)
  ).length;

  // Conta fornecedores únicos com OC pendente para badge em Pedidos de Compra
  const ocFornCount = new Set(
    items
      .filter(i => compraSugeridaFerramenta(i) !== null)
      .map(i => i.razao_social_fornecedor)
      .filter(Boolean)
  ).size;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h1 className="page-title">Ferramentas</h1>
            <p className="page-subtitle">Estoque e ordens de compra · BigQuery em tempo real</p>
          </div>
          <SobreButton onClick={() => setShowSobre(true)} />
        </div>
        <a
          href="http://app.datateck.com.br:9092/toolguard/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{ fontSize: "0.82rem", textDecoration: "none" }}
        >
          ⚙ Tool Guard ↗
        </a>
        <button className="btn-ghost" onClick={loadAll} style={{ fontSize: "0.82rem" }}>
          Atualizar
        </button>
      </div>
      {showSobre && <SobreModal onClose={() => setShowSobre(false)} />}

      <div className="tab-bar">
        <button className={`tab-btn${tab === "lista" ? " active" : ""}`} onClick={() => setTab("lista")}>
          Lista Geral
        </button>
        <button className={`tab-btn${tab === "sem-config" ? " active" : ""}`} onClick={() => setTab("sem-config")}>
          Forn. Pendentes
          {!loading && semConfigCount > 0 && (
            <span style={{ marginLeft: 6, background: "var(--danger)", color: "#080808", borderRadius: 10, padding: "1px 6px", fontSize: "0.7rem", fontWeight: 600 }}>
              {semConfigCount}
            </span>
          )}
        </button>
        <button className={`tab-btn${tab === "sem-ferramenta" ? " active" : ""}`} onClick={() => setTab("sem-ferramenta")}>
          Ferr. Pendentes
        </button>
        <button className={`tab-btn${tab === "oc-ferramentas" ? " active" : ""}`} onClick={() => setTab("oc-ferramentas")}>
          Pedidos de Compra
          {!loading && ocFornCount > 0 && (
            <span style={{ marginLeft: 6, background: "var(--warning, #f59e0b)", color: "#080808", borderRadius: 10, padding: "1px 6px", fontSize: "0.7rem", fontWeight: 600 }}>
              {ocFornCount}
            </span>
          )}
        </button>
        <button className={`tab-btn${tab === "disparo" ? " active" : ""}`} onClick={() => setTab("disparo")}>
          ✉ Disparo E-mail
        </button>
      </div>

      {tab === "lista" && <FerramentasListTab items={items} loading={loading} error={error} />}
      {tab === "sem-config" && <SemConfigTab items={items} loading={loading} />}
      {tab === "sem-ferramenta" && <SemFerramentaTab />}
      {tab === "oc-ferramentas" && (
        <OcPreviewTab
          getPreview={() => OrdensCompraService.getPreviewFerramentas()}
          downloadExcel={() => OrdensCompraService.downloadExcelFerramentas()}
          titulo="OC Ferramentas"
        />
      )}
      {tab === "disparo" && (
        <DisparoTab
          modulo="ferramentas"
          descricao="Envia o Excel de OC de ferramentas para o operador ERP e um dashboard executivo com o valor estimado de compras para o gestor."
          dispararFn={() => DisparoService.dispararFerramentas()}
          getLogFn={() => DisparoService.getLog("ferramentas")}
        />
      )}
    </div>
  );
}
