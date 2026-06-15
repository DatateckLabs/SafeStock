import httpx
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user_profile import UserProfile


class CurrentUser:
    def __init__(self, username: str, role: str, groups: list[str],
                 permissions: list[str], apps: list[str]):
        self.username    = username
        self.role        = role
        self.groups      = groups
        self.permissions = permissions
        self.apps        = apps

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_gestor(self) -> bool:
        return self.role in ("admin", "gestor")


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autenticação ausente.")

    token = auth_header.split(" ", 1)[1]
    base  = settings.auth_base_url.rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            verify_resp = await client.post(
                f"{base}/api/token/verify/",
                json={"token": token},
            )
            if verify_resp.status_code != 200 or not verify_resp.json().get("valid"):
                raise HTTPException(status_code=401, detail="Token inválido ou expirado.")

            me_resp = await client.get(
                f"{base}/api/me/",
                headers={"Authorization": f"Bearer {token}"},
            )
            if me_resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Falha ao obter dados do usuário.")

            me = me_resp.json()

    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Serviço de autenticação indisponível.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Erro ao conectar com auth: {str(e)}")

    username = me["username"]
    profile = db.query(UserProfile).filter(
        UserProfile.username == username,
        UserProfile.is_active == True,
    ).first()

    if not profile:
        raise HTTPException(
            status_code=403,
            detail="Usuário não cadastrado no SafeStock. Solicite acesso ao administrador.",
        )

    return CurrentUser(
        username=profile.username,
        role=profile.role,
        groups=me.get("groups", []),
        permissions=me.get("permissions", []),
        apps=me.get("apps", []),
    )


def require_role(*roles: str):
    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Permissão insuficiente para esta ação.")
        return current_user
    return checker
