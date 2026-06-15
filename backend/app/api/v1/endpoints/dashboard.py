from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, CurrentUser
from app.db.session import get_db
from app.schemas.dashboard import DashboardStats
from app.services.dashboard_service import get_dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats/", response_model=DashboardStats)
async def stats(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    return await get_dashboard_stats(db)
