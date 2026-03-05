from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.schemas.schemas import DashboardMetrics
from app.services.dashboard_service import get_dashboard_metrics


router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard/metrics", response_model=DashboardMetrics)
async def dashboard_metrics(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return get_dashboard_metrics(db)
