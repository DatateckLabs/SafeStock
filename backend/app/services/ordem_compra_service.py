import asyncio
import math
import os
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import CurrentUser
from app.models.estoque_minimo import EstoqueMinimo
from app.models.ordem_compra import OrdemCompraGerada, ItemOrdemCompraGerada
from app.models.parametro_global import ParametroGlobal
from app.schemas.ordem_compra import OrdemCompraGeradaResponse, GerarOCResponse
from app.services import bigquery_service
from app.services.csv_service import gerar_csv_oc, calcular_quantidade_oc
from app.services.email_service import enviar_oc_por_email
from app.services.ferramentas_service import get_ferramentas


def _get_param(db: Session, chave: str, default: str = "") -> str:
    obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
    return obj.valor if obj else default


def _numero_oc(db: Session, tipo: str) -> str:
    count = db.query(OrdemCompraGerada).filter(OrdemCompraGerada.tipo == tipo).count()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"OC-{tipo.upper()[:3]}-{count + 1:04d}-{ts}"


async def gerar_oc_insumos(db: Session, current_user: CurrentUser) -> GerarOCResponse:
    subgrupos_raw = _get_param(db, "subgrupos_insumos", "ETIQUETA,RIBBON")
    subgrupos = [s.strip() for s in subgrupos_raw.split(",") if s.strip()]

    bq_rows = await asyncio.to_thread(bigquery_service.get_insumos, subgrupos)
    estoques: dict[str, EstoqueMinimo] = {e.cpd: e for e in db.query(EstoqueMinimo).all()}
    email_destino = _get_param(db, "email_destino_oc")

    itens_por_fornecedor: dict[str, list[dict]] = defaultdict(list)

    for row in bq_rows:
        cpd = str(row.get("CPD") or "")
        est_obj = estoques.get(cpd)
        if not est_obj:
            continue
        atual = float(row.get("ESTOQUE_ALMOXARIFADO") or 0)
        est_min = float(est_obj.estoque_minimo or 0)
        est_max = float(est_obj.estoque_maximo or 0)

        if est_min <= 0 or atual >= est_min:
            continue

        qtd = calcular_quantidade_oc(
            estoque_atual=atual,
            estoque_maximo=est_max,
            moq=float(row.get("MOQ") or 0),
            mpq=float(row.get("MPQ") or 0),
            quantidade_pendente_oc=float(row.get("QUANTIDADE_PENDENTE_OC") or 0),
        )
        if qtd <= 0:
            continue

        fornecedor = str(row.get("RAZAO_SOCIAL_FORNECEDOR") or "SEM_FORNECEDOR")
        itens_por_fornecedor[fornecedor].append({
            "cpd": cpd,
            "descricao": str(row.get("DESCRICAO_COMPLEMENTAR") or ""),
            "quantidade": qtd,
            "unidade": str(row.get("UN__MEDIDA") or ""),
            "fornecedor": fornecedor,
            "observacao": "",
            "estoque_atual": atual,
            "estoque_minimo": est_min,
        })

    if not itens_por_fornecedor:
        raise HTTPException(status_code=422, detail="Nenhum insumo abaixo do estoque mínimo.")

    ordens: list[OrdemCompraGerada] = []
    os.makedirs("oc_files", exist_ok=True)

    for fornecedor, itens in itens_por_fornecedor.items():
        filename, csv_content = gerar_csv_oc(itens, fornecedor, "insumos")
        filepath = os.path.join("oc_files", filename)

        with open(filepath, "wb") as f:
            f.write(csv_content)

        oc = OrdemCompraGerada(
            numero_oc_interno=_numero_oc(db, "insumo"),
            tipo="insumo",
            status="gerada",
            arquivo_path=filepath,
            email_destinatario=email_destino,
            gerado_por_username=current_user.username,
        )
        db.add(oc)
        db.flush()

        for item in itens:
            db.add(ItemOrdemCompraGerada(
                ordem_compra_id=oc.id,
                cpd=item["cpd"],
                descricao_item=item["descricao"],
                qtd_solicitada=item["quantidade"],
                unidade=item["unidade"],
                razao_social_fornecedor=fornecedor,
                estoque_atual=item["estoque_atual"],
                estoque_minimo_calculado=item["estoque_minimo"],
            ))

        if email_destino:
            try:
                await enviar_oc_por_email(db, email_destino, fornecedor, "insumos", filename, csv_content)
                oc.status = "enviada"
                oc.enviado_at = datetime.now(timezone.utc)
            except Exception as exc:
                oc.status = "erro"
                oc.erro_msg = str(exc)

        ordens.append(oc)

    db.commit()
    for oc in ordens:
        db.refresh(oc)

    total_itens = sum(len(itens) for itens in itens_por_fornecedor.values())
    return GerarOCResponse(
        ordens=[OrdemCompraGeradaResponse.model_validate(oc) for oc in ordens],
        total_itens=total_itens,
        mensagem=f"{len(ordens)} OC(s) gerada(s) para {total_itens} item(ns).",
    )


async def gerar_oc_ferramentas(db: Session, current_user: CurrentUser) -> GerarOCResponse:
    ferramentas = await get_ferramentas(db)
    email_destino = _get_param(db, "email_destino_oc")

    itens_por_fornecedor: dict[str, list[dict]] = defaultdict(list)

    for f in ferramentas:
        if f.situacao == "ok" or f.estoque_minimo_calculado <= 0:
            continue

        moq = f.moq if f.moq > 0 else 1
        qtd = max(f.estoque_minimo_calculado - f.estoque_atual, moq)
        qtd = math.ceil(qtd / moq) * moq if moq > 0 else qtd

        fornecedor = f.razao_social_fornecedor or "SEM_FORNECEDOR"
        itens_por_fornecedor[fornecedor].append({
            "cpd": f.cpd_ferramenta,
            "descricao": f.descricao or "",
            "quantidade": round(qtd, 2),
            "unidade": f.unidade or "",
            "fornecedor": fornecedor,
            "observacao": f"Criticidade: {f.criticidade}",
            "estoque_atual": f.estoque_atual,
            "estoque_minimo": f.estoque_minimo_calculado,
        })

    if not itens_por_fornecedor:
        raise HTTPException(status_code=422, detail="Nenhuma ferramenta abaixo do estoque mínimo calculado.")

    ordens: list[OrdemCompraGerada] = []
    os.makedirs("oc_files", exist_ok=True)

    for fornecedor, itens in itens_por_fornecedor.items():
        filename, csv_content = gerar_csv_oc(itens, fornecedor, "ferramentas")
        filepath = os.path.join("oc_files", filename)

        with open(filepath, "wb") as f_:
            f_.write(csv_content)

        oc = OrdemCompraGerada(
            numero_oc_interno=_numero_oc(db, "ferramenta"),
            tipo="ferramenta",
            status="gerada",
            arquivo_path=filepath,
            email_destinatario=email_destino,
            gerado_por_username=current_user.username,
        )
        db.add(oc)
        db.flush()

        for item in itens:
            db.add(ItemOrdemCompraGerada(
                ordem_compra_id=oc.id,
                cpd=item["cpd"],
                descricao_item=item["descricao"],
                qtd_solicitada=item["quantidade"],
                unidade=item["unidade"],
                razao_social_fornecedor=fornecedor,
                estoque_atual=item["estoque_atual"],
                estoque_minimo_calculado=item["estoque_minimo"],
            ))

        if email_destino:
            try:
                await enviar_oc_por_email(db, email_destino, fornecedor, "ferramentas", filename, csv_content)
                oc.status = "enviada"
                oc.enviado_at = datetime.now(timezone.utc)
            except Exception as exc:
                oc.status = "erro"
                oc.erro_msg = str(exc)

        ordens.append(oc)

    db.commit()
    for oc in ordens:
        db.refresh(oc)

    total_itens = sum(len(itens) for itens in itens_por_fornecedor.values())
    return GerarOCResponse(
        ordens=[OrdemCompraGeradaResponse.model_validate(oc) for oc in ordens],
        total_itens=total_itens,
        mensagem=f"{len(ordens)} OC(s) gerada(s) para {total_itens} ferramenta(s).",
    )
