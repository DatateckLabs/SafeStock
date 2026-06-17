import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth_middleware import require_role, CurrentUser
from app.db.session import get_db
from app.models.disparo_log import DisparoLog
from app.schemas.disparo import DisparoLogResponse, DisparoResult
from app.services.disparo_service import executar_disparo, executar_disparo_ferramentas

router = APIRouter(prefix="/disparos", tags=["disparos"])


def _msg(log: DisparoLog) -> str:
    if log.status == "ok":
        if log.valor_total_brl:
            return (
                f"Disparo realizado. {log.total_fornecedores} fornecedor(es), "
                f"{log.total_itens} item(ns). "
                f"Valor estimado: R$ {log.valor_total_brl:,.2f}"
            )
        return "Disparo realizado."
    return f"Erro no disparo: {log.erro_msg}"


@router.post("/insumos", response_model=DisparoResult)
async def disparo_manual_insumos(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "gestor", "operador")),
):
    try:
        log = await executar_disparo(db, tipo="manual")
        return DisparoResult(log=DisparoLogResponse.model_validate(log), mensagem=_msg(log))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}\n\n{traceback.format_exc()}")


@router.post("/ferramentas", response_model=DisparoResult)
async def disparo_manual_ferramentas(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "gestor", "operador")),
):
    log = await executar_disparo_ferramentas(db, tipo="manual")
    return DisparoResult(log=DisparoLogResponse.model_validate(log), mensagem=_msg(log))


@router.get("/log", response_model=list[DisparoLogResponse])
async def listar_log(
    modulo: Optional[str] = Query(None, description="Filtrar por modulo: insumos | ferramentas"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "gestor", "operador")),
):
    q = db.query(DisparoLog)
    if modulo:
        q = q.filter(DisparoLog.modulo == modulo)
    return [
        DisparoLogResponse.model_validate(r)
        for r in q.order_by(DisparoLog.created_at.desc()).limit(100).all()
    ]
