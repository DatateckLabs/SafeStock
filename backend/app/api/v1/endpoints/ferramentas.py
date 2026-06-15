from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, CurrentUser
from app.db.session import get_db
from app.schemas.ferramenta import FerramentaResponse, DrilldownItem
from app.services.ferramentas_service import get_ferramentas, get_drilldown

router = APIRouter(prefix="/ferramentas", tags=["ferramentas"])


@router.get("/", response_model=list[FerramentaResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_ferramentas(db)


@router.get("/{cpd_ferramenta}/drilldown/", response_model=list[DrilldownItem])
async def drilldown(
    cpd_ferramenta: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_drilldown(cpd_ferramenta, db)
