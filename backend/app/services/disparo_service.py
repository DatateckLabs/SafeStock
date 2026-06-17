"""
Serviço de disparo de e-mails: manual e agendado.
- Envia Excel de OC de insumos para o operador ERP
- Envia dashboard executivo HTML para o gestor
- Registra log em DisparoLog
"""
import asyncio
import math
from datetime import date, datetime
from pathlib import Path

import httpx
from sqlalchemy.orm import Session

_PASTA_DISPAROS = Path(__file__).resolve().parents[3] / "disparos"


def _salvar_local(filename: str, content: bytes) -> None:
    """Salva arquivo em disparos/ com timestamp para evitar conflito com arquivo aberto."""
    try:
        _PASTA_DISPAROS.mkdir(parents=True, exist_ok=True)
        stem, suffix = filename.rsplit(".", 1) if "." in filename else (filename, "")
        ts = datetime.now().strftime("%H%M%S")
        destino = _PASTA_DISPAROS / f"{stem}_{ts}.{suffix}"
        destino.write_bytes(content)
    except Exception:
        pass  # salvar localmente é melhor esforço — não deve abortar o disparo

from sqlalchemy import func, distinct as sa_distinct

from app.db.session import SessionLocal
from app.models.disparo_log import DisparoLog
from app.models.disparo_item_log import DisparoItemLog
from app.models.parametro_global import ParametroGlobal
from app.services import bigquery_service
from app.services.email_service import enviar_email_generico
from app.services.ordem_compra_service import gerar_excel_oc_insumos, gerar_excel_oc_ferramentas


def _get_param(db: Session, chave: str, default: str = "") -> str:
    obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
    return obj.valor if obj else default


def _salvar_itens_log(
    db: Session,
    log_id: int,
    modulo: str,
    fornecedores_preview: list,
    precos: dict,
    cotacao: float | None,
) -> None:
    """Persiste cada item do disparo na tabela de histórico analítico."""
    for forn in fornecedores_preview:
        for item in forn.itens:
            cpd = str(item.cpd)
            info = precos.get(cpd, {})
            preco = float(info.get("preco", 0.0))
            moeda = info.get("moeda", "BRL")
            qtd = math.ceil(float(item.qtd_sugerida or 0))
            valor_brl = preco * qtd
            if moeda == "USD" and cotacao:
                valor_brl *= cotacao
            db.add(DisparoItemLog(
                disparo_log_id=log_id,
                modulo=modulo,
                cpd=cpd,
                descricao=getattr(item, "codigo_fabricante", None) or item.descricao,
                razao_social_fornecedor=forn.razao_social,
                qtd_sugerida=qtd,
                preco_unitario=preco,
                moeda=moeda,
                valor_brl=round(valor_brl, 2),
                ocs_abertas=float(item.ocs_abertas or 0),
                estoque_atual=float(getattr(item, "estoque_atual", None) or 0),
            ))


def _query_historico(db: Session, modulo: str):
    """Retorna ([], reincidencia_rows) para o HTML executivo.
    reincidencia_rows: lista de dicts com cpd, descricao, razao_social_fornecedor,
    vezes, primeiro_disparo (datetime), estoque_primeira_vez (float).
    """
    base = (
        db.query(
            DisparoItemLog.cpd,
            DisparoItemLog.descricao,
            DisparoItemLog.razao_social_fornecedor,
            func.count(sa_distinct(DisparoItemLog.disparo_log_id)).label("vezes"),
        )
        .filter(DisparoItemLog.modulo == modulo, DisparoItemLog.ocs_abertas == 0)
        .group_by(
            DisparoItemLog.cpd,
            DisparoItemLog.descricao,
            DisparoItemLog.razao_social_fornecedor,
        )
        .having(func.count(sa_distinct(DisparoItemLog.disparo_log_id)) > 1)
        .order_by(func.count(sa_distinct(DisparoItemLog.disparo_log_id)).desc())
        .all()
    )

    reincidencia = []
    for r in base:
        first = (
            db.query(DisparoLog.created_at, DisparoItemLog.estoque_atual)
            .join(DisparoLog, DisparoItemLog.disparo_log_id == DisparoLog.id)
            .filter(DisparoItemLog.modulo == modulo, DisparoItemLog.cpd == r.cpd)
            .order_by(DisparoLog.created_at)
            .first()
        )
        reincidencia.append({
            "cpd": r.cpd,
            "descricao": r.descricao,
            "razao_social_fornecedor": r.razao_social_fornecedor,
            "vezes": int(r.vezes or 0),
            "primeiro_disparo": first.created_at if first else None,
            "estoque_primeira_vez": float(first.estoque_atual or 0) if first else None,
        })

    return [], reincidencia


async def _fetch_cotacao_usd_brl() -> float | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get("https://economia.awesomeapi.com.br/last/USD-BRL")
            r.raise_for_status()
            data = r.json()
            return float(data["USDBRL"]["bid"])
    except Exception:
        return None


def _calcular_valor_total(
    fornecedores_preview: list,
    precos_por_cpd: dict[str, dict],
    cotacao: float | None,
) -> float:
    total = 0.0
    for forn in fornecedores_preview:
        for item in forn.itens:
            cpd = str(item.cpd)
            info = precos_por_cpd.get(cpd)
            if not info:
                continue
            preco = info.get("preco", 0.0)
            moeda = info.get("moeda", "BRL")
            qtd = math.ceil(float(item.qtd_sugerida or 0))
            valor_item = preco * qtd
            if moeda == "USD" and cotacao:
                valor_item *= cotacao
            total += valor_item
    return round(total, 2)


def _fmtbr(n: float, dec: int = 2) -> str:
    """Formata número no padrão brasileiro: 1.234.567,89"""
    s = f"{n:,.{dec}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _coletar_alertas_sem_preco(
    fornecedores_preview: list,
    precos_por_cpd: dict[str, dict],
) -> list[dict]:
    """Retorna itens com preço zero ou ausente no BigQuery."""
    sem_preco: list[dict] = []
    vistos: set[str] = set()
    for forn in fornecedores_preview:
        for item in forn.itens:
            cpd = str(item.cpd)
            if cpd in vistos:
                continue
            vistos.add(cpd)
            preco = (precos_por_cpd.get(cpd) or {}).get("preco", 0.0)
            if not preco:
                sem_preco.append({
                    "cpd": cpd,
                    "fornecedor": forn.razao_social,
                    "motivo": "Sem preço cadastrado — item não entra no valor estimado",
                })
    return sem_preco


def _build_html_dashboard(
    fornecedores_preview: list,
    precos_por_cpd: dict[str, dict],
    cotacao: float | None,
    valor_total_brl: float,
    tipo: str,
    pareto_rows: list | None = None,      # não usado — pareto calculado do lote atual
    reincidencia_rows: list | None = None,
    alertas: list[dict] | None = None,
) -> str:
    hoje = date.today().strftime("%d/%m/%Y")
    cotacao_str = f"R$ {cotacao:.4f}" if cotacao else "N/D"
    n_fornecedores = len(fornecedores_preview)
    n_itens = sum(len(f.itens) for f in fornecedores_preview)

    # ── Tabela do disparo atual + coleta para pareto ──────────────────────────
    linhas_html = ""
    itens_pareto: list[dict] = []
    for forn in fornecedores_preview:
        for item in forn.itens:
            cpd = str(item.cpd)
            info = precos_por_cpd.get(cpd, {})
            preco = info.get("preco", 0.0)
            moeda = info.get("moeda", "BRL")
            qtd = math.ceil(float(item.qtd_sugerida or 0))
            valor_brl = preco * qtd
            if moeda == "USD" and cotacao:
                valor_brl *= cotacao
            preco_fmt = f"{_fmtbr(preco, 4)} {moeda}"
            cod_fab = getattr(item, "codigo_fabricante", None) or item.descricao or "—"
            linhas_html += f"""
            <tr>
              <td class="muted">{forn.razao_social}</td>
              <td><code class="muted">{item.cpd}</code></td>
              <td>{cod_fab}</td>
              <td style="text-align:right">{_fmtbr(qtd, 0)}</td>
              <td style="text-align:right" class="muted">{preco_fmt}</td>
              <td style="text-align:right" class="green">R$ {_fmtbr(valor_brl)}</td>
            </tr>"""
            itens_pareto.append({
                "cpd": cpd,
                "descricao": cod_fab,
                "fornecedor": forn.razao_social,
                "valor_brl": round(valor_brl, 2),
            })

    # ── Pareto do lote atual ──────────────────────────────────────────────────
    secao_pareto = ""
    if itens_pareto:
        itens_pareto.sort(key=lambda x: x["valor_brl"], reverse=True)
        total_p = sum(x["valor_brl"] for x in itens_pareto) or 1
        acum = 0.0
        linhas_pareto = ""
        for i, p in enumerate(itens_pareto, 1):
            pct = p["valor_brl"] / total_p * 100
            acum += pct
            cor_acum = "red" if acum <= 80 else "muted"
            linhas_pareto += f"""
            <tr>
              <td class="muted" style="text-align:center">{i}</td>
              <td><code class="muted">{p["cpd"]}</code></td>
              <td>{p["descricao"]}</td>
              <td class="muted">{p["fornecedor"]}</td>
              <td style="text-align:right" class="green">R$ {_fmtbr(p["valor_brl"])}</td>
              <td style="text-align:right" class="muted">{pct:.1f}%</td>
              <td style="text-align:right" class="{cor_acum}">{acum:.1f}%</td>
            </tr>"""
        secao_pareto = f"""
  <div class="section">
    <div class="section-title">Pareto do lote — por valor</div>
    <table>
      <thead><tr>
        <th style="width:28px">#</th>
        <th>CPD</th><th>Cód. Fabricante</th><th>Fornecedor</th>
        <th style="text-align:right">Valor (BRL)</th>
        <th style="text-align:right">%</th>
        <th style="text-align:right">% Acum.</th>
      </tr></thead>
      <tbody>{linhas_pareto}</tbody>
    </table>
  </div>"""

    # ── Seção Reincidência ────────────────────────────────────────────────────
    secao_reincidencia = ""
    if reincidencia_rows:
        linhas_rein = ""
        for r in reincidencia_rows:
            vezes = int(r["vezes"] or 0) if isinstance(r, dict) else int(getattr(r, "vezes", 0) or 0)
            cpd_r = r["cpd"] if isinstance(r, dict) else r.cpd
            desc_r = (r["descricao"] if isinstance(r, dict) else r.descricao) or "—"
            forn_r = (r["razao_social_fornecedor"] if isinstance(r, dict) else r.razao_social_fornecedor) or "—"
            primeiro = r["primeiro_disparo"] if isinstance(r, dict) else None
            estoque_pv = r["estoque_primeira_vez"] if isinstance(r, dict) else None
            cls_vezes = "red" if vezes >= 3 else "orange"
            data_str = primeiro.strftime("%d/%m/%y") if primeiro else "—"
            estoque_str = _fmtbr(estoque_pv) if estoque_pv is not None else "—"
            linhas_rein += f"""
            <tr>
              <td><code class="muted">{cpd_r}</code></td>
              <td>{desc_r}</td>
              <td class="muted">{forn_r}</td>
              <td style="text-align:center" class="{cls_vezes}">{vezes}×</td>
              <td style="text-align:center" class="muted">{data_str}</td>
              <td style="text-align:right">{estoque_str}</td>
            </tr>"""
        secao_reincidencia = f"""
  <div class="section">
    <div class="section-title" style="color:#dc2626">⚠ Itens recorrentes sem OC aberta</div>
    <table>
      <thead><tr>
        <th>CPD</th><th>Cód. Fabricante</th><th>Fornecedor</th>
        <th style="text-align:center">Vezes</th>
        <th style="text-align:center">1º Disparo</th>
        <th style="text-align:right">Estoque na época</th>
      </tr></thead>
      <tbody>{linhas_rein}</tbody>
    </table>
  </div>"""

    # ── Seção Alertas / Pendências ────────────────────────────────────────────
    secao_alertas = ""
    if alertas:
        linhas_alertas = ""
        for a in alertas:
            motivo = a.get("motivo", "")
            cor_mot = "red" if "bloqueado" in motivo.lower() else "orange"
            linhas_alertas += f"""
            <tr>
              <td><code class="muted">{a.get("cpd","—")}</code></td>
              <td class="muted">{a.get("fornecedor","—")}</td>
              <td class="{cor_mot}">{motivo}</td>
            </tr>"""
        secao_alertas = f"""
  <div class="section">
    <div class="section-title" style="color:#d97706">⚠ Pendências — ação necessária</div>
    <table>
      <thead><tr>
        <th>CPD</th><th>Fornecedor</th><th>Problema</th>
      </tr></thead>
      <tbody>{linhas_alertas}</tbody>
    </table>
  </div>"""

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:13px;background:#fff;color:#111;padding:28px 32px;line-height:1.5;max-width:960px;margin:0 auto}}
    .header{{border-left:4px solid #04a804;padding-left:12px;margin-bottom:20px}}
    .header h1{{font-size:17px;font-weight:700;color:#111;margin-bottom:2px}}
    .header .meta{{color:#6b7280;font-size:11px}}
    .summary{{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 16px;margin-bottom:22px;font-size:13px;color:#374151}}
    .summary strong{{color:#111;font-size:16px;font-weight:700}}
    .section{{margin-bottom:24px}}
    .section-title{{font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px}}
    table{{border-collapse:collapse;width:100%;font-size:12px}}
    th{{background:#111;color:#fff;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:7px 10px;text-align:left}}
    td{{padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#111}}
    tr:nth-child(even) td{{background:#fafafa}}
    .muted{{color:#6b7280}}
    .green{{color:#111;font-weight:700}}
    .red{{color:#dc2626;font-weight:700}}
    .orange{{color:#d97706;font-weight:700}}
    .footer{{color:#9ca3af;font-size:10px;margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center}}
  </style>
</head>
<body>
  <div class="header">
    <h1>SafeStock — Compras {tipo} · {hoje}</h1>
    <p class="meta">Cotação USD→BRL: {cotacao_str}</p>
  </div>

  <div class="summary">
    Valor estimado do lote: <strong>R$ {_fmtbr(valor_total_brl)}</strong>
    &nbsp;·&nbsp; {n_fornecedores} fornecedores &nbsp;·&nbsp; {n_itens} itens
  </div>

  {secao_alertas}

  <div class="section">
    <div class="section-title">Necessidades de compra</div>
    <table>
      <thead><tr>
        <th>Fornecedor</th><th>CPD</th><th>Cód. Fabricante</th>
        <th style="text-align:right">Qtd</th>
        <th style="text-align:right">Preço Unit.</th>
        <th style="text-align:right">Valor (BRL)</th>
      </tr></thead>
      <tbody>{linhas_html}</tbody>
    </table>
  </div>

  {secao_pareto}
  {secao_reincidencia}
  <div class="footer">Gerado automaticamente pelo SafeStock</div>
</body>
</html>"""


async def executar_disparo(db: Session, tipo: str = "manual") -> DisparoLog:
    email_operacional = _get_param(db, "email_operacional")
    email_gestor      = _get_param(db, "email_gestor")
    log = DisparoLog(
        tipo=tipo, modulo="insumos", status="erro",
        email_operacional=email_operacional or None,
        email_gestor=email_gestor or None,
    )

    # Captura variáveis para o pós-commit (itens, HTML, e-mail)
    fornecedores_preview: list = []
    precos:      dict         = {}
    cotacao:     float | None = None
    valor_total: float        = 0.0
    excel_bytes: bytes        = b""
    filename:    str          = ""
    alertas_excel: list[dict] = []

    try:
        from app.services.ordem_compra_service import _build_preview_fornecedores  # noqa: PLC0415
        from fastapi import HTTPException as _HTTPException               # noqa: PLC0415
        try:
            fornecedores_preview, _ = await _build_preview_fornecedores(db)
        except _HTTPException:
            fornecedores_preview = []

        if not fornecedores_preview:
            log.status = "ok"
            log.total_fornecedores = 0
            log.total_itens = 0
            log.valor_total_brl = 0.0
            log.erro_msg = "Nenhum insumo abaixo do estoque mínimo."
            db.add(log); db.commit(); db.refresh(log)
            return log

        excel_bytes, filename, alertas_excel = await gerar_excel_oc_insumos(db)
        log.arquivo_nome = filename
        _salvar_local(filename, excel_bytes)

        todos_cpds = list({str(item.cpd) for forn in fornecedores_preview for item in forn.itens})
        try:
            precos = await asyncio.to_thread(bigquery_service.get_precos_por_cpds, todos_cpds)
        except Exception:
            precos = {}

        cotacao = await _fetch_cotacao_usd_brl()
        log.cotacao_usd_brl = cotacao

        valor_total = _calcular_valor_total(fornecedores_preview, precos, cotacao)
        log.valor_total_brl = valor_total
        log.total_fornecedores = len(fornecedores_preview)
        log.total_itens = sum(len(f.itens) for f in fornecedores_preview)
        log.status = "ok"

    except Exception as exc:
        log.status = "erro"
        log.erro_msg = str(exc)[:1000]
        try: db.rollback()   # limpa sessão inválida antes do commit
        except Exception: pass

    # Commit principal — sempre funciona após rollback ou sessão limpa
    db.add(log)
    db.commit()
    db.refresh(log)

    if not fornecedores_preview:
        return log

    # Salva itens + busca histórico (transação separada, melhor esforço)
    pareto: list = []
    reincidencia: list = []
    try:
        _salvar_itens_log(db, log.id, "insumos", fornecedores_preview, precos, cotacao)
        db.commit()
        pareto, reincidencia = _query_historico(db, "insumos")
    except Exception:
        try: db.rollback()
        except Exception: pass

    # Agrega alertas: bloqueios do Excel + itens sem preço
    alertas_sem_preco = _coletar_alertas_sem_preco(fornecedores_preview, precos)
    todos_alertas = alertas_excel + alertas_sem_preco

    # HTML enriquecido com histórico
    html = _build_html_dashboard(fornecedores_preview, precos, cotacao, valor_total, "Insumos", pareto, reincidencia, todos_alertas)
    _salvar_local(f"Dashboard_Insumos_{date.today().strftime('%Y%m%d')}.html", html.encode("utf-8"))

    # E-mails — melhor esforço (só se o disparo foi ok)
    if log.status == "ok":
        hoje = date.today().strftime("%d/%m/%Y")
        erros_email: list[str] = []
        assunto_insumos = f"[SafeStock] OC Insumos — {hoje}"
        for dest in filter(None, [email_operacional, email_gestor]):
            try:
                await enviar_email_generico(
                    db=db, destinatario=dest,
                    assunto=assunto_insumos,
                    corpo_texto=f"Dashboard SafeStock — {hoje}",
                    corpo_html=html,
                    attachments=[(filename, excel_bytes)],
                )
            except Exception as e:
                erros_email.append(f"[email:{dest}] {e}")
        if erros_email:
            log.erro_msg = " ".join(erros_email)[:1000]
            db.commit()

    return log


async def executar_disparo_ferramentas(db: Session, tipo: str = "manual") -> DisparoLog:
    email_operacional = _get_param(db, "email_operacional")
    email_gestor      = _get_param(db, "email_gestor")
    log = DisparoLog(
        tipo=tipo, modulo="ferramentas", status="erro",
        email_operacional=email_operacional or None,
        email_gestor=email_gestor or None,
    )

    fornecedores_preview: list = []
    precos:      dict         = {}
    cotacao:     float | None = None
    valor_total: float        = 0.0
    excel_bytes: bytes        = b""
    filename:    str          = ""
    alertas_excel: list[dict] = []

    try:
        from app.services.ordem_compra_service import _build_preview_fornecedores_ferramentas  # noqa: PLC0415
        from fastapi import HTTPException as _HTTPException                                     # noqa: PLC0415
        try:
            fornecedores_preview, _ = await _build_preview_fornecedores_ferramentas(db)
        except _HTTPException:
            fornecedores_preview = []

        if not fornecedores_preview:
            log.status = "ok"
            log.total_fornecedores = 0
            log.total_itens = 0
            log.valor_total_brl = 0.0
            log.erro_msg = "Nenhuma ferramenta abaixo do estoque mínimo."
            db.add(log); db.commit(); db.refresh(log)
            return log

        excel_bytes, filename, alertas_excel = await gerar_excel_oc_ferramentas(db)
        log.arquivo_nome = filename
        _salvar_local(filename, excel_bytes)

        todos_cpds = list({str(item.cpd) for forn in fornecedores_preview for item in forn.itens})
        try:
            precos = await asyncio.to_thread(bigquery_service.get_precos_por_cpds, todos_cpds)
        except Exception:
            precos = {}

        cotacao = await _fetch_cotacao_usd_brl()
        log.cotacao_usd_brl = cotacao

        valor_total = _calcular_valor_total(fornecedores_preview, precos, cotacao)
        log.valor_total_brl = valor_total
        log.total_fornecedores = len(fornecedores_preview)
        log.total_itens = sum(len(f.itens) for f in fornecedores_preview)
        log.status = "ok"

    except Exception as exc:
        log.status = "erro"
        log.erro_msg = str(exc)[:1000]
        try: db.rollback()
        except Exception: pass

    db.add(log)
    db.commit()
    db.refresh(log)

    if not fornecedores_preview:
        return log

    pareto: list = []
    reincidencia: list = []
    try:
        _salvar_itens_log(db, log.id, "ferramentas", fornecedores_preview, precos, cotacao)
        db.commit()
        pareto, reincidencia = _query_historico(db, "ferramentas")
    except Exception:
        try: db.rollback()
        except Exception: pass

    alertas_sem_preco = _coletar_alertas_sem_preco(fornecedores_preview, precos)
    todos_alertas = alertas_excel + alertas_sem_preco

    html = _build_html_dashboard(fornecedores_preview, precos, cotacao, valor_total, "Ferramentas", pareto, reincidencia, todos_alertas)
    _salvar_local(f"Dashboard_Ferramentas_{date.today().strftime('%Y%m%d')}.html", html.encode("utf-8"))

    if log.status == "ok":
        hoje = date.today().strftime("%d/%m/%Y")
        erros_email: list[str] = []
        assunto_ferramentas = f"[SafeStock] OC Ferramentas — {hoje}"
        for dest in filter(None, [email_operacional, email_gestor]):
            try:
                await enviar_email_generico(
                    db=db, destinatario=dest,
                    assunto=assunto_ferramentas,
                    corpo_texto=f"Dashboard SafeStock — {hoje}",
                    corpo_html=html,
                    attachments=[(filename, excel_bytes)],
                )
            except Exception as e:
                erros_email.append(f"[email:{dest}] {e}")
        if erros_email:
            log.erro_msg = " ".join(erros_email)[:1000]
            db.commit()

    return log


def executar_disparo_sync() -> None:
    """Wrapper síncrono para o APScheduler chamar (dispara insumos e ferramentas)."""
    db = SessionLocal()
    try:
        asyncio.run(executar_disparo(db, tipo="agendado"))
    finally:
        db.close()

    db = SessionLocal()
    try:
        asyncio.run(executar_disparo_ferramentas(db, tipo="agendado"))
    finally:
        db.close()
