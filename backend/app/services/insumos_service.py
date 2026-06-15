import asyncio
from sqlalchemy.orm import Session

from app.models.estoque_minimo import EstoqueMinimo
from app.models.parametro_global import ParametroGlobal
from app.schemas.insumo import InsumoResponse
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

    ocs_map: dict[str, float] = await asyncio.to_thread(
        bigquery_service.get_ocs_abertas_por_cpds, cpds_norm
    )

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
        ))

    # Ordena: negativo primeiro → zero → positivo (itens sem mínimo por último)
    def _saldo_key(i: InsumoResponse) -> float:
        if i.estoque_minimo <= 0:
            return float("inf")
        return i.estoque_almoxarifado - i.estoque_minimo

    results.sort(key=_saldo_key)
    return results
