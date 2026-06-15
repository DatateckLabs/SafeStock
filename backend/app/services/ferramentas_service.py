import asyncio
import statistics
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.criticidade_ferramenta import CriticidadeFerramenta
from app.models.parametro_global import ParametroGlobal
from app.schemas.ferramenta import FerramentaResponse, DrilldownItem
from app.services import bigquery_service


def _get_param(db: Session, chave: str, default: str) -> str:
    obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
    return obj.valor if obj else default


def _situacao(atual: float, minimo: float) -> str:
    if minimo <= 0:
        return "ok"
    if atual <= 0:
        return "critico"
    if atual < minimo:
        return "alerta"
    return "ok"


async def get_ferramentas(db: Session) -> list[FerramentaResponse]:
    janela_global = int(_get_param(db, "janela_consumo_dias", "365"))
    threshold_global = float(_get_param(db, "threshold_inatividade", "10"))
    fator_k = {
        "alta":  float(_get_param(db, "fator_k_alta", "2.05")),
        "media": float(_get_param(db, "fator_k_media", "1.65")),
        "baixa": float(_get_param(db, "fator_k_baixa", "1.28")),
    }

    consumo_rows = await asyncio.to_thread(bigquery_service.get_ferramentas_consumo, janela_global)

    by_ferramenta: dict[str, list[dict]] = defaultdict(list)
    for row in consumo_rows:
        cpd_f = str(row.get("CPD_FERRAMENTA") or "")
        if cpd_f:
            by_ferramenta[cpd_f].append(row)

    criticidades: dict[str, CriticidadeFerramenta] = {
        c.cpd_ferramenta: c for c in db.query(CriticidadeFerramenta).all()
    }

    cpds_ferramentas = list(by_ferramenta.keys())

    mrp_rows, ocs_map = await asyncio.gather(
        asyncio.to_thread(bigquery_service.get_parametros_mrp_por_cpds, cpds_ferramentas),
        asyncio.to_thread(bigquery_service.get_ocs_abertas_por_cpds, cpds_ferramentas),
    )
    mrp_by_cpd: dict[str, dict] = {str(r.get("CPD") or ""): r for r in mrp_rows}

    results: list[FerramentaResponse] = []

    for cpd_ferramenta, rows in by_ferramenta.items():
        crit_obj = criticidades.get(cpd_ferramenta)
        criticidade = crit_obj.criticidade if crit_obj else "media"
        janela_dias = (
            crit_obj.janela_consumo_dias
            if crit_obj and crit_obj.janela_consumo_dias
            else janela_global
        )
        threshold = (
            crit_obj.threshold_inatividade
            if crit_obj and crit_obj.threshold_inatividade is not None
            else threshold_global
        )

        produzidos = [float(r.get("produzido_mp") or 0) for r in rows]
        pendentes  = [float(r.get("pendente_mp") or 0) for r in rows]

        produzido_total = sum(produzidos)
        pendente_total  = sum(pendentes)
        consumo_total   = produzido_total + pendente_total

        meses = janela_dias / 30.0 if janela_dias > 0 else 1.0
        consumo_mensal = consumo_total / meses

        # Taxa diária derivada — usada só para calcular estoque mínimo
        consumo_medio_dia = consumo_mensal / 30.0

        # Desvio por célula (base para safety stock)
        consumos_celula = [p + e for p, e in zip(produzidos, pendentes)]
        desvio = statistics.stdev(consumos_celula) if len(consumos_celula) > 1 else 0.0
        desvio_dia = desvio / janela_dias if janela_dias > 0 else 0.0

        mrp = mrp_by_cpd.get(cpd_ferramenta, {})
        estoque_atual = float(mrp.get("ESTOQUE_ALMOXARIFADO") or 0)

        if consumo_total < threshold:
            estoque_minimo = 0.0
        else:
            lead_time_dias = float(mrp.get("LEADTIME_SEMANAS") or 0) * 7
            k = fator_k[criticidade]
            estoque_minimo = consumo_medio_dia * lead_time_dias + k * desvio_dia

        results.append(FerramentaResponse(
            cpd_ferramenta=cpd_ferramenta,
            descricao=str(rows[0].get("FERRAMENTA") or ""),
            consumo_mensal=round(consumo_mensal, 2),
            consumo_total=round(consumo_total, 2),
            estoque_atual=estoque_atual,
            estoque_minimo_calculado=round(estoque_minimo, 2),
            ocs_abertas=ocs_map.get(cpd_ferramenta, 0.0),
            situacao=_situacao(estoque_atual, estoque_minimo),
            criticidade=criticidade,
            moq=float(mrp.get("MOQ") or 0),
            leadtime_semanas=float(mrp.get("LEADTIME_SEMANAS") or 0),
            razao_social_fornecedor=str(mrp.get("RAZAO_SOCIAL_FORNECEDOR") or ""),
            unidade=str(mrp.get("UN__MEDIDA") or ""),
        ))

    results.sort(key=lambda f: f.estoque_atual - f.estoque_minimo_calculado)
    return results


async def get_drilldown(cpd_ferramenta: str, db: Session) -> list[DrilldownItem]:
    janela_dias = int(_get_param(db, "janela_consumo_dias", "365"))
    rows = await asyncio.to_thread(
        bigquery_service.get_ferramentas_drilldown, cpd_ferramenta, janela_dias
    )
    return [
        DrilldownItem(
            cpd_materia_prima=str(r.get("CPD_MATERIA_PRIMA") or ""),
            descricao=str(r.get("DESCRICAO_COMPLEMENTAR") or "") or None,
            ops_pendentes=float(r.get("ops_pendentes") or 0),
            consumo_mensal_ferramenta=float(r.get("consumo_mensal_ferramenta") or 0),
        )
        for r in rows
    ]
