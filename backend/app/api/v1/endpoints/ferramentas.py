from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, CurrentUser
from app.db.session import get_db
from app.schemas.ferramenta import FerramentaResponse, DrilldownItem, ConsumoMensalItem, SemFerramentaItem
from app.services.ferramentas_service import get_ferramentas, get_drilldown, get_consumo_mensal, get_consumo_mensal_terminal, get_sem_ferramenta

router = APIRouter(prefix="/ferramentas", tags=["ferramentas"])


@router.get("/", response_model=list[FerramentaResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_ferramentas(db)


@router.get("/sem-ferramenta/", response_model=list[SemFerramentaItem])
async def sem_ferramenta(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_sem_ferramenta(db)


@router.get("/{cpd_ferramenta}/drilldown/", response_model=list[DrilldownItem])
async def drilldown(
    cpd_ferramenta: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_drilldown(cpd_ferramenta, db)


@router.get("/{cpd_ferramenta}/consumo-mensal/", response_model=list[ConsumoMensalItem])
async def consumo_mensal(
    cpd_ferramenta: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_consumo_mensal(cpd_ferramenta, db)


@router.get("/terminais/{cpd_terminal}/consumo-mensal/", response_model=list[ConsumoMensalItem])
async def consumo_mensal_terminal(
    cpd_terminal: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_consumo_mensal_terminal(cpd_terminal, db)
