import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, require_role, CurrentUser
from app.db.session import get_db
from app.models.config_fornecedor import ConfigFornecedor
from app.schemas.config_fornecedor import ConfigFornecedorUpsert, ConfigFornecedorResponse
from app.services import bigquery_service

router = APIRouter(prefix="/config-fornecedores", tags=["cadastros"])


@router.get("/sugestoes/", response_model=list[str])
async def sugestoes_mrp(
    _: CurrentUser = Depends(get_current_user),
):
    """Retorna razões sociais distintas do MRP para autocomplete."""
    return await asyncio.to_thread(bigquery_service.get_razoes_sociais_mrp)


@router.get("/", response_model=list[ConfigFornecedorResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return db.query(ConfigFornecedor).order_by(ConfigFornecedor.razao_social).all()


@router.put("/{razao_social}/", response_model=ConfigFornecedorResponse)
async def upsert(
    razao_social: str,
    payload: ConfigFornecedorUpsert,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    obj = db.query(ConfigFornecedor).filter(ConfigFornecedor.razao_social == razao_social).first()
    if not obj:
        obj = ConfigFornecedor(razao_social=razao_social)
        db.add(obj)
    obj.leadtime_meses  = payload.leadtime_meses
    obj.cobertura_meses = payload.cobertura_meses
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{razao_social}/", status_code=204)
async def deletar(
    razao_social: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    obj = db.query(ConfigFornecedor).filter(ConfigFornecedor.razao_social == razao_social).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    db.delete(obj)
    db.commit()
