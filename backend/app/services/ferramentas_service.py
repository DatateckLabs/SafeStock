import asyncio
import statistics
from collections import defaultdict
from sqlalchemy.orm import Session


def _safe_div(num: float, den: int) -> float:
    return round(num / den, 2) if den > 0 else 0.0


def _norm_cpd(cpd: str) -> str:
    """Normaliza CPD para inteiro-string ('30214.0' → '30214'), igual ao CAST do BQ."""
    try:
        return str(int(float(cpd)))
    except (ValueError, TypeError):
        return cpd

from app.models.criticidade_ferramenta import CriticidadeFerramenta
from app.models.config_ferramenta import ConfigFerramenta
from app.models.config_fornecedor import ConfigFornecedor
from app.models.parametro_global import ParametroGlobal
from app.schemas.ferramenta import FerramentaResponse, DrilldownItem, ConsumoMensalItem, SemFerramentaItem
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
    threshold_global = float(_get_param(db, "threshold_inatividade", "10"))
    cobertura_padrao = float(_get_param(db, "cobertura_meses_padrao", "2"))

    consumo_rows = await asyncio.to_thread(bigquery_service.get_ferramentas_consumo)

    by_ferramenta: dict[str, list[dict]] = defaultdict(list)
    for row in consumo_rows:
        cpd_f = _norm_cpd(str(row.get("CPD_FERRAMENTA") or ""))
        if cpd_f:
            by_ferramenta[cpd_f].append(row)

    criticidades: dict[str, CriticidadeFerramenta] = {
        c.cpd_ferramenta: c for c in db.query(CriticidadeFerramenta).all()
    }
    cfg_ferramenta_map: dict[str, ConfigFerramenta] = {
        c.cpd_ferramenta: c for c in db.query(ConfigFerramenta).all()
    }
    cfg_fornecedor_map: dict[str, ConfigFornecedor] = {
        c.razao_social: c for c in db.query(ConfigFornecedor).all()
    }

    cpds_ferramentas = list(by_ferramenta.keys())

    mrp_rows, ocs_map = await asyncio.gather(
        asyncio.to_thread(bigquery_service.get_parametros_mrp_por_cpds, cpds_ferramentas),
        asyncio.to_thread(bigquery_service.get_ocs_abertas_por_cpds, cpds_ferramentas),
    )
    mrp_by_cpd: dict[str, dict] = {_norm_cpd(str(r.get("CPD") or "")): r for r in mrp_rows}

    results: list[FerramentaResponse] = []

    for cpd_ferramenta, rows in by_ferramenta.items():
        crit_obj = criticidades.get(cpd_ferramenta)
        criticidade = crit_obj.criticidade if crit_obj else "media"
        threshold = (
            crit_obj.threshold_inatividade
            if crit_obj and crit_obj.threshold_inatividade is not None
            else threshold_global
        )

        produzido_total = sum(float(r.get("produzido_mp") or 0) for r in rows)
        pendente_total  = sum(float(r.get("pendente_mp") or 0) for r in rows)
        consumo_total   = produzido_total + pendente_total

        # consumo da ferramenta = soma dos consumos de cada terminal (meses por terminal)
        consumo_historico_mensal = sum(
            _safe_div(float(r.get("produzido_mp") or 0), int(r.get("meses_produzido") or 0))
            for r in rows
        )
        consumo_pendente_mensal = sum(
            _safe_div(float(r.get("pendente_mp") or 0), int(r.get("meses_pendente") or 0))
            for r in rows
        )
        consumo_mensal = sum(
            _safe_div(
                float(r.get("produzido_mp") or 0) + float(r.get("pendente_mp") or 0),
                int(r.get("meses_total") or 0)
            )
            for r in rows
        )
        # janela_meses: maior span de meses entre os terminais (para exibição no tooltip)
        meses_tot = max((int(r.get("meses_total") or 0) for r in rows), default=0)

        mrp = mrp_by_cpd.get(cpd_ferramenta, {})
        estoque_atual = float(mrp.get("ESTOQUE_ALMOXARIFADO") or 0)
        razao_social  = str(mrp.get("RAZAO_SOCIAL_FORNECEDOR") or "")

        cfg_f    = cfg_ferramenta_map.get(cpd_ferramenta)
        cfg_forn = cfg_fornecedor_map.get(razao_social)

        durabilidade_bq = float(rows[0].get("DURABILIDADE_BTD") or 0)
        aplicacoes = durabilidade_bq if durabilidade_bq > 0 else 80_000.0

        # Leadtime (em meses): override manual > BQ LEADTIME_SEMANAS > config fornecedor
        lt_bq_semanas = float(mrp.get("LEADTIME_SEMANAS") or 0)
        lt_bq_meses   = lt_bq_semanas / 4.33 if lt_bq_semanas > 0 else 0.0
        if cfg_f and cfg_f.leadtime_override is not None:
            leadtime_meses = float(cfg_f.leadtime_override)
        elif lt_bq_meses > 0:
            leadtime_meses = lt_bq_meses
        elif cfg_forn:
            leadtime_meses = float(cfg_forn.leadtime_meses)
        else:
            leadtime_meses = 0.0

        usa_cobertura_padrao = cfg_forn is None
        cobertura_meses = float(cfg_forn.cobertura_meses) if cfg_forn else cobertura_padrao

        # consumo_ferramenta_mensal = consumo_mensal_terminais / durabilidade
        # estoque_minimo = consumo_ferramenta_mensal * (leadtime_meses + cobertura_meses)
        if consumo_total >= threshold and (leadtime_meses + cobertura_meses) > 0:
            estoque_minimo = consumo_mensal * (leadtime_meses + cobertura_meses) / aplicacoes
        else:
            estoque_minimo = 0.0

        consumo_ferra_mensal = round(consumo_mensal / aplicacoes, 6) if aplicacoes > 0 else 0.0

        cod_fab = str(mrp.get("CODIGO_FABRICANTE") or "") or None

        results.append(FerramentaResponse(
            cpd_ferramenta=cpd_ferramenta,
            descricao=str(rows[0].get("FERRAMENTA") or ""),
            codigo_fabricante=cod_fab,
            consumo_mensal=round(consumo_mensal, 2),
            consumo_historico_mensal=round(consumo_historico_mensal, 2),
            consumo_pendente_mensal=round(consumo_pendente_mensal, 2),
            janela_meses=float(meses_tot),
            janela_dias=meses_tot * 30,
            produzido_total=round(produzido_total, 2),
            pendente_total=round(pendente_total, 2),
            consumo_total=round(consumo_total, 2),
            estoque_atual=estoque_atual,
            estoque_minimo_calculado=round(estoque_minimo, 4),
            ocs_abertas=ocs_map.get(cpd_ferramenta, 0.0),
            situacao=_situacao(estoque_atual, estoque_minimo),
            criticidade=criticidade,
            moq=float(mrp.get("MOQ") or 0),
            leadtime_semanas=float(mrp.get("LEADTIME_SEMANAS") or 0),
            leadtime_meses_calc=round(leadtime_meses, 4),
            cobertura_meses=cobertura_meses,
            usa_cobertura_padrao=usa_cobertura_padrao,
            aplicacoes=aplicacoes,
            consumo_ferramenta_mensal=consumo_ferra_mensal,
            num_terminais=len(rows),
            razao_social_fornecedor=str(mrp.get("RAZAO_SOCIAL_FORNECEDOR") or ""),
            unidade=str(mrp.get("UN__MEDIDA") or ""),
            data_ultimo_inventario=str(mrp.get("DATA_ULTIMO_INVENTARIO_ESTOQUE") or "") or None,
            preco_compra=float(mrp.get("PRE_O_COMPRA") or 0),
            moeda=str(mrp.get("MOEDA") or "BRL"),
        ))

    results.sort(key=lambda f: f.estoque_atual - f.estoque_minimo_calculado)
    return results


async def get_consumo_mensal(cpd_ferramenta: str, db: Session) -> list[ConsumoMensalItem]:
    rows = await asyncio.to_thread(
        bigquery_service.get_consumo_por_mes, cpd_ferramenta
    )
    return [
        ConsumoMensalItem(
            mes_ano=str(r.get("mes_ano") or ""),
            produzido=float(r.get("produzido") or 0),
            pendente=float(r.get("pendente") or 0),
        )
        for r in rows
    ]


async def get_consumo_mensal_terminal(cpd_materia_prima: str, db: Session) -> list[ConsumoMensalItem]:
    rows = await asyncio.to_thread(
        bigquery_service.get_consumo_por_mes_terminal, cpd_materia_prima
    )
    return [
        ConsumoMensalItem(
            mes_ano=str(r.get("mes_ano") or ""),
            produzido=float(r.get("produzido") or 0),
            pendente=float(r.get("pendente") or 0),
        )
        for r in rows
    ]


async def get_sem_ferramenta(db: Session) -> list[SemFerramentaItem]:
    subgrupos_insumos_raw = _get_param(db, "subgrupos_insumos", "ETIQUETAS EXTERNAS,ETIQUETAS E RIBBONS INTERNAS")
    subgrupos_excluir = [s.strip().upper() for s in subgrupos_insumos_raw.split(",") if s.strip()]
    rows = await asyncio.to_thread(bigquery_service.get_sem_ferramenta, subgrupos_excluir)
    return [
        SemFerramentaItem(
            cpd_materia_prima=str(r.get("CPD_MATERIA_PRIMA") or ""),
            codigo_fabricante=str(r.get("CODIGO_FABRICANTE") or "") or None,
            descricao=str(r.get("DESCRICAO_COMPLEMENTAR") or "") or None,
            subgrupo=str(r.get("SUBGRUPO") or "") or None,
            produzido_total=float(r.get("produzido_total") or 0),
            pendente_total=float(r.get("pendente_total") or 0),
            janela_meses=float(r.get("meses_total") or 0),
            consumo_historico_mensal=_safe_div(
                float(r.get("produzido_total") or 0), int(r.get("meses_produzido") or 0)
            ),
            consumo_pendente_mensal=_safe_div(
                float(r.get("pendente_total") or 0), int(r.get("meses_pendente") or 0)
            ),
            consumo_mensal=_safe_div(
                float(r.get("produzido_total") or 0) + float(r.get("pendente_total") or 0),
                int(r.get("meses_total") or 0)
            ),
        )
        for r in rows
    ]


async def get_drilldown(cpd_ferramenta: str, db: Session) -> list[DrilldownItem]:
    rows = await asyncio.to_thread(
        bigquery_service.get_ferramentas_drilldown, cpd_ferramenta
    )
    return [
        DrilldownItem(
            cpd_materia_prima=str(r.get("CPD_MATERIA_PRIMA") or ""),
            descricao=str(r.get("DESCRICAO_COMPLEMENTAR") or "") or None,
            codigo_fabricante=str(r.get("CODIGO_FABRICANTE") or "") or None,
            ops_pendentes=float(r.get("ops_pendentes") or 0),
            produzido_raw=float(r.get("produzido_mp") or 0),
            janela_meses=float(r.get("meses_total") or 0),
            consumo_historico_mensal=_safe_div(
                float(r.get("produzido_mp") or 0), int(r.get("meses_produzido") or 0)
            ),
            consumo_pendente_mensal=_safe_div(
                float(r.get("ops_pendentes") or 0), int(r.get("meses_pendente") or 0)
            ),
            consumo_mensal_ferramenta=_safe_div(
                float(r.get("produzido_mp") or 0) + float(r.get("ops_pendentes") or 0),
                int(r.get("meses_total") or 0)
            ),
        )
        for r in rows
    ]
