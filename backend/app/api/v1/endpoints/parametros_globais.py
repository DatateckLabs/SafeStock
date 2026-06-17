from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, require_role, CurrentUser
from app.db.session import get_db
from app.models.parametro_global import ParametroGlobal
from app.schemas.parametro_global import ParametroGlobalUpdate, ParametroGlobalResponse

router = APIRouter(prefix="/parametros-globais", tags=["cadastros"])


@router.get("/", response_model=list[ParametroGlobalResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return db.query(ParametroGlobal).order_by(ParametroGlobal.chave).all()


@router.get("/{chave}/", response_model=ParametroGlobalResponse)
async def buscar(
    chave: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Parâmetro não encontrado.")
    return obj


@router.put("/{chave}/", response_model=ParametroGlobalResponse)
async def atualizar(
    chave: str,
    payload: ParametroGlobalUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
    if not obj:
        obj = ParametroGlobal(chave=chave, valor=payload.valor, descricao=payload.descricao)
        db.add(obj)
    else:
        obj.valor = payload.valor
        if payload.descricao is not None:
            obj.descricao = payload.descricao
    db.commit()
    db.refresh(obj)
    return obj
