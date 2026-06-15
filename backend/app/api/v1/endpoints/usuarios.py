from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import require_role, CurrentUser
from app.db.session import get_db
from app.models.user_profile import UserProfile
from app.schemas.user_profile import UserProfileCreate, UserProfileUpdate, UserProfileResponse

router = APIRouter(prefix="/usuarios", tags=["usuários"])


@router.get("/", response_model=list[UserProfileResponse])
async def listar(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    return db.query(UserProfile).order_by(UserProfile.username).all()


@router.post("/", response_model=UserProfileResponse, status_code=201)
async def criar(
    payload: UserProfileCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    if db.query(UserProfile).filter(UserProfile.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Usuário já cadastrado.")
    profile = UserProfile(**payload.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{id}/", response_model=UserProfileResponse)
async def atualizar(
    id: int,
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    profile = db.query(UserProfile).filter(UserProfile.id == id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    data = payload.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(profile, key, val)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{id}/", status_code=204)
async def desativar(
    id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    profile = db.query(UserProfile).filter(UserProfile.id == id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    profile.is_active = False
    db.commit()
