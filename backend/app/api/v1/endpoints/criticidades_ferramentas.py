from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, require_role, CurrentUser
from app.db.session import get_db
from app.models.criticidade_ferramenta import CriticidadeFerramenta
from app.schemas.criticidade_ferramenta import CriticidadeFerramentaUpsert, CriticidadeFerramentaResponse

router = APIRouter(prefix="/criticidades-ferramentas", tags=["cadastros"])


@router.get("/", response_model=list[CriticidadeFerramentaResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return db.query(CriticidadeFerramenta).order_by(CriticidadeFerramenta.cpd_ferramenta).all()


@router.get("/{cpd_ferramenta}/", response_model=CriticidadeFerramentaResponse)
async def buscar(
    cpd_ferramenta: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    obj = db.query(CriticidadeFerramenta).filter(
        CriticidadeFerramenta.cpd_ferramenta == cpd_ferramenta
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="CPD_FERRAMENTA não cadastrado.")
    return obj


@router.post("/{cpd_ferramenta}/", response_model=CriticidadeFerramentaResponse, status_code=201)
async def criar(
    cpd_ferramenta: str,
    payload: CriticidadeFerramentaUpsert,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    if db.query(CriticidadeFerramenta).filter(
        CriticidadeFerramenta.cpd_ferramenta == cpd_ferramenta
    ).first():
        raise HTTPException(status_code=409, detail="CPD já cadastrado. Use PUT para atualizar.")
    obj = CriticidadeFerramenta(cpd_ferramenta=cpd_ferramenta, **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{cpd_ferramenta}/", response_model=CriticidadeFerramentaResponse)
async def atualizar(
    cpd_ferramenta: str,
    payload: CriticidadeFerramentaUpsert,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    obj = db.query(CriticidadeFerramenta).filter(
        CriticidadeFerramenta.cpd_ferramenta == cpd_ferramenta
    ).first()
    if not obj:
        obj = CriticidadeFerramenta(cpd_ferramenta=cpd_ferramenta)
        db.add(obj)
    for key, val in payload.model_dump().items():
        setattr(obj, key, val)
    db.commit()
    db.refresh(obj)
    return obj
