import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io
from sqlalchemy.orm import Session

from app.core.auth_middleware import require_role, CurrentUser
from app.db.session import get_db
from app.models.ordem_compra import OrdemCompraGerada
from app.schemas.ordem_compra import OrdemCompraGeradaResponse, GerarOCResponse, PreviewOCResponse
from app.services import bigquery_service
from app.services.ordem_compra_service import (
    gerar_oc_insumos,
    gerar_oc_ferramentas,
    gerar_excel_oc_insumos,
    gerar_excel_oc_ferramentas,
    get_preview_oc_insumos,
    get_preview_oc_ferramentas,
)

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


# Static routes MUST come before /{id}/ to avoid being swallowed by the path param
@router.get("/preview-insumos/", response_model=PreviewOCResponse)
async def preview_insumos(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    return await get_preview_oc_insumos(db)


@router.get("/excel-insumos/")
async def excel_insumos(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    excel_bytes, filename = await gerar_excel_oc_insumos(db)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/preview-ferramentas/", response_model=PreviewOCResponse)
async def preview_ferramentas(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    return await get_preview_oc_ferramentas(db)


@router.get("/excel-ferramentas/")
async def excel_ferramentas(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    excel_bytes, filename = await gerar_excel_oc_ferramentas(db)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
