from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_permission
from app.core.database import get_db
from app.schemas.report_schemas import MaintenanceReportResponse
from app.services.report_service import get_maintenance_report


router = APIRouter(tags=["reports"])


@router.get("/api/reports/maintenance", response_model=MaintenanceReportResponse)
async def maintenance_report(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    maintenance_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    technician: Optional[str] = Query(None),
    has_ticket: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _user=Depends(require_permission("generate_report")),
):
    # maintenance_type: Preventiva | Corretiva | (vazio/qualquer outro => ambas)
    return get_maintenance_report(
        db,
        from_date=from_date,
        to_date=to_date,
        maintenance_type=maintenance_type,
        q=q,
        technician=technician,
        has_ticket=has_ticket,
        page=page,
        page_size=page_size,
    )
