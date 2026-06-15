import asyncio
from datetime import date, timezone, datetime
from sqlalchemy.orm import Session

from app.models.estoque_minimo import EstoqueMinimo
from app.models.ordem_compra import OrdemCompraGerada
from app.models.parametro_global import ParametroGlobal
from app.schemas.dashboard import DashboardStats, AlertaItem
from app.services import bigquery_service
from app.services.ferramentas_service import get_ferramentas


def _get_param(db: Session, chave: str, default: str) -> str:
    obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
    return obj.valor if obj else default


async def get_dashboard_stats(db: Session) -> DashboardStats:
    subgrupos_raw = _get_param(db, "subgrupos_insumos", "ETIQUETA,RIBBON")
    subgrupos = [s.strip() for s in subgrupos_raw.split(",") if s.strip()]

    insumos_bq, ferramentas = await asyncio.gather(
        asyncio.to_thread(bigquery_service.get_insumos, subgrupos),
        get_ferramentas(db),
    )

    estoques: dict[str, EstoqueMinimo] = {e.cpd: e for e in db.query(EstoqueMinimo).all()}

    alertas: list[AlertaItem] = []
    insumos_abaixo = 0

    for row in insumos_bq:
        cpd = str(row.get("CPD") or "")
        est_obj = estoques.get(cpd)
        if not est_obj:
            continue
        atual = float(row.get("ESTOQUE_ALMOXARIFADO") or 0)
        est_min = float(est_obj.estoque_minimo or 0)
        if est_min <= 0:
            continue
        if atual < est_min:
            insumos_abaixo += 1
            situacao = "critico" if atual <= 0 else "alerta"
            alertas.append(AlertaItem(
                cpd=cpd,
                descricao=str(row.get("DESCRICAO_COMPLEMENTAR") or ""),
                tipo="insumo",
                situacao=situacao,
                estoque_atual=atual,
                estoque_minimo=est_min,
            ))

    ferramentas_criticas = 0
    for f in ferramentas:
        if f.situacao in ("alerta", "critico"):
            ferramentas_criticas += 1
            alertas.append(AlertaItem(
                cpd=f.cpd_ferramenta,
                descricao=f.descricao or "",
                tipo="ferramenta",
                situacao=f.situacao,
                estoque_atual=f.estoque_atual,
                estoque_minimo=f.estoque_minimo_calculado,
            ))

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    ocs_hoje = db.query(OrdemCompraGerada).filter(
        OrdemCompraGerada.created_at >= today_start
    ).count()

    alertas.sort(key=lambda a: 0 if a.situacao == "critico" else 1)

    return DashboardStats(
        insumos_abaixo_minimo=insumos_abaixo,
        ferramentas_criticas=ferramentas_criticas,
        ocs_geradas_hoje=ocs_hoje,
        alertas=alertas[:50],
    )
