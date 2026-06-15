from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth_middleware import require_role, CurrentUser
from app.db.session import get_db
from app.models.disparo_log import DisparoLog
from app.schemas.disparo import DisparoLogResponse, DisparoResult
from app.services.disparo_service import executar_disparo

router = APIRouter(prefix="/disparos", tags=["disparos"])


@router.post("/insumos", response_model=DisparoResult)
async def disparo_manual_insumos(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "gestor", "operador")),
):
    log = await executar_disparo(db, tipo="manual")
    if log.status == "ok":
        msg = (
            f"Disparo realizado. {log.total_fornecedores} fornecedor(es), "
            f"{log.total_itens} item(ns). "
            f"Valor estimado: R$ {log.valor_total_brl:,.2f}" if log.valor_total_brl else "Disparo realizado."
        )
    else:
        msg = f"Erro no disparo: {log.erro_msg}"
    return DisparoResult(log=DisparoLogResponse.model_validate(log), mensagem=msg)


@router.get("/log", response_model=list[DisparoLogResponse])
async def listar_log(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "gestor")),
):
    return [
        DisparoLogResponse.model_validate(r)
        for r in db.query(DisparoLog).order_by(DisparoLog.created_at.desc()).limit(100).all()
    ]
