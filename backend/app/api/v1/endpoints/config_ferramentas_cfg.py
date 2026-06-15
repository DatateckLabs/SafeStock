from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, require_role, CurrentUser
from app.db.session import get_db
from app.models.config_ferramenta import ConfigFerramenta
from app.schemas.config_ferramenta import ConfigFerramentaUpsert, ConfigFerramentaResponse

router = APIRouter(prefix="/config-ferramentas", tags=["cadastros"])


@router.get("/", response_model=list[ConfigFerramentaResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return db.query(ConfigFerramenta).order_by(ConfigFerramenta.cpd_ferramenta).all()


@router.put("/{cpd_ferramenta}/", response_model=ConfigFerramentaResponse)
async def upsert(
    cpd_ferramenta: str,
    payload: ConfigFerramentaUpsert,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "gestor")),
):
    obj = db.query(ConfigFerramenta).filter(ConfigFerramenta.cpd_ferramenta == cpd_ferramenta).first()
    if not obj:
        obj = ConfigFerramenta(cpd_ferramenta=cpd_ferramenta)
        db.add(obj)
    obj.aplicacoes        = payload.aplicacoes
    obj.leadtime_override = payload.leadtime_override
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{cpd_ferramenta}/", status_code=204)
async def deletar(
    cpd_ferramenta: str,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    obj = db.query(ConfigFerramenta).filter(ConfigFerramenta.cpd_ferramenta == cpd_ferramenta).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Ferramenta não encontrada.")
    db.delete(obj)
    db.commit()
