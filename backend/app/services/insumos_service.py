import asyncio
import logging
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.estoque_minimo import EstoqueMinimo
from app.models.parametro_global import ParametroGlobal
from app.schemas.insumo import InsumoResponse, InsumoChicoteItem
from app.services import bigquery_service


def _get_param(db: Session, chave: str, default: str = "") -> str:
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


def _norm_cpd(raw) -> str:
    if raw is None:
        return ""
    try:
        return str(int(float(str(raw))))
    except (ValueError, TypeError):
        return str(raw)


async def get_insumos(db: Session) -> list[InsumoResponse]:
    subgrupos_raw = _get_param(db, "subgrupos_insumos", "ETIQUETAS EXTERNAS,ETIQUETAS E RIBBONS INTERNAS")
    subgrupos = [s.strip() for s in subgrupos_raw.split(",") if s.strip()]

    bq_rows, bq_estoques = await asyncio.gather(
        asyncio.to_thread(bigquery_service.get_insumos, subgrupos),
        asyncio.to_thread(bigquery_service.get_estoques_minimos_bq),
    )

    # Overrides manuais gravados localmente no PostgreSQL
    estoques_local: dict[str, EstoqueMinimo] = {
        e.cpd: e for e in db.query(EstoqueMinimo).all()
    }

    # Normaliza CPDs para montar lista para query de OCs
    cpds_norm = []
    rows_with_cpd = []
    for row in bq_rows:
        cpd = _norm_cpd(row.get("CPD"))
        if cpd:
            cpds_norm.append(cpd)
            rows_with_cpd.append((cpd, row))

    try:
        ocs_map_raw, consumo_rows = await asyncio.gather(
            asyncio.to_thread(bigquery_service.get_ocs_abertas_por_cpds, cpds_norm),
            asyncio.to_thread(bigquery_service.get_insumos_consumo, cpds_norm),
        )
        ocs_map: dict[str, float] = ocs_map_raw
        logger.info("get_insumos_consumo retornou %d linhas", len(consumo_rows))
    except Exception as exc:
        logger.exception("Falha ao buscar consumo de insumos no BigQuery: %s", exc)
        ocs_map = await asyncio.to_thread(bigquery_service.get_ocs_abertas_por_cpds, cpds_norm)
        consumo_rows = []

    def _safe_div(num: float, den: int) -> float:
        return num / den if den else 0.0

    consumo_map: dict[str, dict] = {}
    for c in consumo_rows:
        cpd_c = str(c["CPD_MATERIA_PRIMA"])
        consumo_map[cpd_c] = {
            "mensal": _safe_div(float(c.get("produzido_total") or 0) + float(c.get("pendente_total") or 0), int(c.get("meses_total") or 0)),
            "historico": _safe_div(float(c.get("produzido_total") or 0), int(c.get("meses_produzido") or 0)),
            "pendente": _safe_div(float(c.get("pendente_total") or 0), int(c.get("meses_pendente") or 0)),
        }

    results: list[InsumoResponse] = []
    for cpd, row in rows_with_cpd:
        # Estoque mínimo: override local > BigQuery Silver > 0
        local_obj = estoques_local.get(cpd) or estoques_local.get(f"{float(cpd):.1f}" if cpd.isdigit() else cpd)
        if local_obj and float(local_obj.estoque_minimo) > 0:
            est_min = float(local_obj.estoque_minimo)
        else:
            est_min = bq_estoques.get(cpd, 0.0)
        est_max = float(local_obj.estoque_maximo) if local_obj else 0.0
        atual = float(row.get("ESTOQUE_ALMOXARIFADO") or 0)
        c = consumo_map.get(cpd, {})

        results.append(InsumoResponse(
            cpd=cpd,
            descricao=str(row.get("DESCRICAO_COMPLEMENTAR") or ""),
            codigo_fabricante=str(row.get("CODIGO_FABRICANTE") or "") or None,
            subgrupo=str(row.get("SUBGRUPO") or ""),
            estoque_almoxarifado=atual,
            estoque_minimo=est_min,
            estoque_maximo=est_max,
            ocs_abertas=ocs_map.get(cpd, 0.0),
            situacao=_situacao(atual, est_min),
            moq=float(row.get("MOQ") or 0),
            mpq=float(row.get("MPQ") or 0),
            leadtime_semanas=float(row.get("LEADTIME_SEMANAS") or 0),
            unidade=str(row.get("UN__MEDIDA") or ""),
            razao_social_fornecedor=str(row.get("RAZAO_SOCIAL_FORNECEDOR") or ""),
            quantidade_pendente_oc=float(row.get("QUANTIDADE_PENDENTE_OC") or 0),
            consumo_mensal=c.get("mensal", 0.0),
            consumo_historico_mensal=c.get("historico", 0.0),
            consumo_pendente_mensal=c.get("pendente", 0.0),
            mrp_auto=str(row.get("MRO_AUTO") or "") or None,
            data_ultimo_inventario=str(row.get("DATA_ULTIMO_INVENTARIO_ESTOQUE") or "") or None,
            preco_compra=float(row.get("PRE_O_COMPRA") or 0),
            moeda=str(row.get("MOEDA") or "BRL"),
        ))

    # Ordena: negativo primeiro → zero → positivo (itens sem mínimo por último)
    def _saldo_key(i: InsumoResponse) -> float:
        if i.estoque_minimo <= 0:
            return float("inf")
        return i.estoque_almoxarifado - i.estoque_minimo

    results.sort(key=_saldo_key)
    return results


async def get_insumo_drilldown(cpd: str) -> list[InsumoChicoteItem]:
    rows = await asyncio.to_thread(bigquery_service.get_insumo_drilldown, cpd)

    def _safe_div(num: float, den: int) -> float:
        return num / den if den else 0.0

    return [
        InsumoChicoteItem(
            descricao_produto=str(r.get("descricao_produto") or "") or None,
            cliente=str(r.get("cliente") or "") or None,
            consumo_mensal=_safe_div(
                float(r.get("produzido_total") or 0) + float(r.get("pendente_total") or 0),
                int(r.get("meses_total") or 0),
            ),
            consumo_historico_mensal=_safe_div(
                float(r.get("produzido_total") or 0),
                int(r.get("meses_produzido") or 0),
            ),
            consumo_pendente_mensal=_safe_div(
                float(r.get("pendente_total") or 0),
                int(r.get("meses_pendente") or 0),
            ),
            meses_total=int(r.get("meses_total") or 0),
        )
        for r in rows
    ]
