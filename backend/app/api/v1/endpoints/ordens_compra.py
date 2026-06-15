import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import require_role, CurrentUser
from app.db.session import get_db
from app.models.ordem_compra import OrdemCompraGerada
from app.schemas.ordem_compra import OrdemCompraGeradaResponse, GerarOCResponse
from app.services import bigquery_service
from app.services.ordem_compra_service import gerar_oc_insumos, gerar_oc_ferramentas

router = APIRouter(prefix="/ordens-compra", tags=["ordens de compra"])


@router.get("/", tags=["ordens de compra"])
async def listar(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "gestor")),
):
    locais = db.query(OrdemCompraGerada).order_by(OrdemCompraGerada.created_at.desc()).limit(200).all()
    bq_ocs = await asyncio.to_thread(bigquery_service.get_ocs_view)
    return {
        "locais": [OrdemCompraGeradaResponse.model_validate(o) for o in locais],
        "historico_bq": bq_ocs,
    }


@router.get("/{id}/", response_model=OrdemCompraGeradaResponse)
async def detalhe(
    id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    oc = db.query(OrdemCompraGerada).filter(OrdemCompraGerada.id == id).first()
    if not oc:
        raise HTTPException(status_code=404, detail="OC não encontrada.")
    return oc


@router.post("/gerar-insumos/", response_model=GerarOCResponse)
async def gerar_insumos(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "gestor")),
):
    return await gerar_oc_insumos(db, current_user)


@router.post("/gerar-ferramentas/", response_model=GerarOCResponse)
async def gerar_ferramentas(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "gestor")),
):
    return await gerar_oc_ferramentas(db, current_user)
