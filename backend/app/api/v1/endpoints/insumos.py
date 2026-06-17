from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, require_role, CurrentUser
from app.db.session import get_db
from app.models.estoque_minimo import EstoqueMinimo
from app.schemas.estoque_minimo import EstoqueMinimoUpsert, EstoqueMinimoResponse
from app.schemas.insumo import InsumoResponse, InsumoChicoteItem
from app.services.insumos_service import get_insumos, get_insumo_drilldown

router = APIRouter(prefix="/insumos", tags=["insumos"])


@router.get("/", response_model=list[InsumoResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_insumos(db)


@router.get("/{cpd}/drilldown/", response_model=list[InsumoChicoteItem])
async def drilldown(
    cpd: str,
    _: CurrentUser = Depends(get_current_user),
):
    return await get_insumo_drilldown(cpd)


@router.put("/{cpd}/estoque/", response_model=EstoqueMinimoResponse)
async def atualizar_estoque(
    cpd: str,
    payload: EstoqueMinimoUpsert,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    obj = db.query(EstoqueMinimo).filter(EstoqueMinimo.cpd == cpd).first()
    if obj:
        obj.estoque_minimo = payload.estoque_minimo
        obj.estoque_maximo = payload.estoque_maximo
        if payload.observacao is not None:
            obj.observacao = payload.observacao
    else:
        obj = EstoqueMinimo(cpd=cpd, **payload.model_dump())
        db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
