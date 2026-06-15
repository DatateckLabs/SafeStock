from fastapi import APIRouter, Depends
from app.core.auth_middleware import get_current_user, CurrentUser
from app.schemas.user_profile import MeResponse

router = APIRouter()


@router.get("/me/", response_model=MeResponse, tags=["auth"])
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    return MeResponse(
        username=current_user.username,
        role=current_user.role,
        groups=current_user.groups,
        permissions=current_user.permissions,
        apps=current_user.apps,
    )
