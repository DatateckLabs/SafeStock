from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, require_role, CurrentUser
from app.db.session import get_db
from app.models.estoque_minimo import EstoqueMinimo
from app.schemas.estoque_minimo import EstoqueMinimoUpsert, EstoqueMinimoResponse

router = APIRouter(prefix="/estoques-minimos", tags=["cadastros"])


@router.get("/", response_model=list[EstoqueMinimoResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return db.query(EstoqueMinimo).order_by(EstoqueMinimo.cpd).all()


@router.get("/{cpd}/", response_model=EstoqueMinimoResponse)
async def buscar(
    cpd: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    obj = db.query(EstoqueMinimo).filter(EstoqueMinimo.cpd == cpd).first()
    if not obj:
        raise HTTPException(status_code=404, detail="CPD não cadastrado.")
    return obj


@router.post("/{cpd}/", response_model=EstoqueMinimoResponse, status_code=201)
async def criar(
    cpd: str,
    payload: EstoqueMinimoUpsert,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    if db.query(EstoqueMinimo).filter(EstoqueMinimo.cpd == cpd).first():
        raise HTTPException(status_code=409, detail="CPD já cadastrado. Use PUT para atualizar.")
    obj = EstoqueMinimo(cpd=cpd, **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{cpd}/", response_model=EstoqueMinimoResponse)
async def atualizar(
    cpd: str,
    payload: EstoqueMinimoUpsert,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    obj = db.query(EstoqueMinimo).filter(EstoqueMinimo.cpd == cpd).first()
    if not obj:
        obj = EstoqueMinimo(cpd=cpd)
        db.add(obj)
    for key, val in payload.model_dump().items():
        setattr(obj, key, val)
    db.commit()
    db.refresh(obj)
    return obj
