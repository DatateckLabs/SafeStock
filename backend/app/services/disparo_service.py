"""
Serviço de disparo de e-mails: manual e agendado.
- Envia Excel de OC de insumos para o operador ERP
- Envia dashboard executivo HTML para o gestor
- Registra log em DisparoLog
"""
import asyncio
from datetime import date

import httpx
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.disparo_log import DisparoLog
from app.models.parametro_global import ParametroGlobal
from app.services import bigquery_service
from app.services.email_service import enviar_email_generico
from app.services.ordem_compra_service import gerar_excel_oc_insumos


def _get_param(db: Session, chave: str, default: str = "") -> str:
    obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
    return obj.valor if obj else default


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
            qtd = float(item.qtd_sugerida or 0)
            valor_item = preco * qtd
            if moeda == "USD" and cotacao:
                valor_item *= cotacao
            total += valor_item
    return round(total, 2)


def _build_html_dashboard(
    fornecedores_preview: list,
    precos_por_cpd: dict[str, dict],
    cotacao: float | None,
    valor_total_brl: float,
    tipo: str,
) -> str:
    hoje = date.today().strftime("%d/%m/%Y")
    cotacao_str = f"R$ {cotacao:.4f}" if cotacao else "N/D"

    linhas_html = ""
    for forn in fornecedores_preview:
        for item in forn.itens:
            cpd = str(item.cpd)
            info = precos_por_cpd.get(cpd, {})
            preco = info.get("preco", 0.0)
            moeda = info.get("moeda", "—")
            qtd = float(item.qtd_sugerida or 0)
            valor_brl = preco * qtd
            if moeda == "USD" and cotacao:
                valor_brl *= cotacao
            linhas_html += f"""
            <tr>
              <td>{forn.razao_social}</td>
              <td>{item.cpd}</td>
              <td style="max-width:260px">{item.descricao}</td>
              <td style="text-align:right">{qtd:,.0f}</td>
              <td style="text-align:right">{preco:,.4f} {moeda}</td>
              <td style="text-align:right">R$ {valor_brl:,.2f}</td>
            </tr>"""

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8">
<style>
  body {{font-family: Arial, sans-serif; font-size: 13px; color: #222; background:#f9f9f9; margin:0; padding:24px;}}
  h2 {{color: #04a804;}}
  table {{border-collapse: collapse; width: 100%; background:#fff;}}
  th {{background:#04a804; color:#fff; padding:7px 10px; text-align:left;}}
  td {{border-bottom: 1px solid #e0e0e0; padding:6px 10px;}}
  tr:hover td {{background:#f0fff0;}}
  .total {{font-size:17px; font-weight:bold; color:#04a804; margin-top:16px;}}
  .meta {{color:#888; font-size:12px; margin-bottom:12px;}}
</style>
</head>
<body>
  <h2>SafeStock — Dashboard Executivo de Compras ({tipo})</h2>
  <p class="meta">Data: {hoje} &nbsp;|&nbsp; Cotação USD→BRL: {cotacao_str}</p>
  <table>
    <thead><tr>
      <th>Fornecedor</th><th>CPD</th><th>Descrição</th>
      <th style="text-align:right">Qtd</th>
      <th style="text-align:right">Preço Unit.</th>
      <th style="text-align:right">Valor (BRL)</th>
    </tr></thead>
    <tbody>{linhas_html}</tbody>
  </table>
  <p class="total">Total estimado: R$ {valor_total_brl:,.2f}</p>
  <p class="meta">Gerado automaticamente pelo SafeStock.</p>
</body>
</html>"""


async def executar_disparo(db: Session, tipo: str = "manual") -> DisparoLog:
    """
    Orquestra o disparo completo:
    1. Gera Excel de OC de insumos
    2. Busca preços no BigQuery
    3. Busca cotação USD/BRL
    4. Calcula valor total BRL
    5. Envia e-mail operacional com Excel
    6. Envia e-mail executivo HTML para gestor
    7. Salva DisparoLog
    """
    email_operacional = _get_param(db, "email_operacional")
    email_gestor = _get_param(db, "email_gestor")
    log = DisparoLog(
        tipo=tipo,
        status="erro",
        email_operacional=email_operacional or None,
        email_gestor=email_gestor or None,
    )

    try:
        # 1. Gera Excel e preview
        from app.services.ordem_compra_service import _build_preview_fornecedores  # noqa: PLC0415
        from fastapi import HTTPException as _HTTPException  # noqa: PLC0415
        try:
            fornecedores_preview, _ = await _build_preview_fornecedores(db)
        except _HTTPException:
            # Nenhum insumo abaixo do mínimo — registra OK com zeros
            fornecedores_preview = []

        if not fornecedores_preview:
            log.status = "ok"
            log.total_fornecedores = 0
            log.total_itens = 0
            log.valor_total_brl = 0.0
            log.erro_msg = "Nenhum insumo abaixo do estoque mínimo."
            db.add(log)
            db.commit()
            db.refresh(log)
            return log

        excel_bytes, filename = await gerar_excel_oc_insumos(db)
        log.arquivo_nome = filename

        # 2. Busca preços BigQuery
        todos_cpds = list({str(item.cpd) for forn in fornecedores_preview for item in forn.itens})
        precos = await asyncio.to_thread(bigquery_service.get_precos_por_cpds, todos_cpds)

        # 3. Cotação USD/BRL
        cotacao = await _fetch_cotacao_usd_brl()
        log.cotacao_usd_brl = cotacao

        # 4. Valor total
        valor_total = _calcular_valor_total(fornecedores_preview, precos, cotacao)
        log.valor_total_brl = valor_total
        log.total_fornecedores = len(fornecedores_preview)
        log.total_itens = sum(len(f.itens) for f in fornecedores_preview)

        # 5. E-mail operacional com Excel
        if email_operacional:
            hoje = date.today().strftime("%d/%m/%Y")
            await enviar_email_generico(
                db=db,
                destinatario=email_operacional,
                assunto=f"[SafeStock] OC Insumos — Importação ERP — {hoje}",
                corpo_texto=(
                    f"Olá,\n\nSegue em anexo o arquivo Excel de Ordens de Compra de Insumos "
                    f"gerado pelo SafeStock em {hoje}.\n\n"
                    f"Fornecedores: {log.total_fornecedores}\n"
                    f"Itens: {log.total_itens}\n\n"
                    f"Por favor, importe o arquivo no ERP.\n\n"
                    f"Mensagem automática — SafeStock"
                ),
                attachments=[(filename, excel_bytes)],
            )

        # 6. E-mail executivo para gestor
        if email_gestor:
            html = _build_html_dashboard(fornecedores_preview, precos, cotacao, valor_total, "Insumos")
            hoje = date.today().strftime("%d/%m/%Y")
            await enviar_email_generico(
                db=db,
                destinatario=email_gestor,
                assunto=f"[SafeStock] Dashboard Executivo de Compras — {hoje}",
                corpo_texto=(
                    f"Dashboard de Compras SafeStock — {hoje}\n\n"
                    f"Fornecedores: {log.total_fornecedores}\n"
                    f"Itens: {log.total_itens}\n"
                    f"Valor total estimado: R$ {valor_total:,.2f}\n"
                    f"Cotação USD/BRL: {cotacao or 'N/D'}\n\n"
                    f"Veja o e-mail em HTML para o dashboard completo."
                ),
                corpo_html=html,
            )

        log.status = "ok"

    except Exception as exc:
        log.status = "erro"
        log.erro_msg = str(exc)[:1000]

    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def executar_disparo_sync() -> None:
    """Wrapper síncrono para o APScheduler chamar."""
    db = SessionLocal()
    try:
        asyncio.run(executar_disparo(db, tipo="agendado"))
    finally:
        db.close()
