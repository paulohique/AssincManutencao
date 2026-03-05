from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.models import Computer, MaintenanceHistory, MaintenanceHistoryAudit
from app.schemas.schemas import MaintenanceAuditListResponse, MaintenanceAuditRowOut


router = APIRouter(tags=["audit"])


@router.get("/api/audit/maintenance", response_model=MaintenanceAuditListResponse)
async def list_maintenance_audit_global(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None, description="Filter: update|delete"),
    db: Session = Depends(get_db),
    _user=Depends(require_admin),
) -> MaintenanceAuditListResponse:
    base_q = db.query(MaintenanceHistoryAudit)
    if action:
        base_q = base_q.filter(MaintenanceHistoryAudit.action == str(action))

    total = int(base_q.with_entities(func.count()).scalar() or 0)

    # Tenta resolver computer_name via computer_id; fallback via maintenance -> computer.
    # Para deletions com manutenção já apagada, computer_id/snapshot garantem contexto.
    coalesced_computer_id = func.coalesce(MaintenanceHistoryAudit.computer_id, MaintenanceHistory.computer_id)

    q = (
        db.query(MaintenanceHistoryAudit, Computer.name)
        .outerjoin(MaintenanceHistory, MaintenanceHistory.id == MaintenanceHistoryAudit.maintenance_id)
        .outerjoin(Computer, Computer.id == coalesced_computer_id)
    )

    if action:
        q = q.filter(MaintenanceHistoryAudit.action == str(action))

    q = (
        q.order_by(desc(MaintenanceHistoryAudit.edited_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items: list[MaintenanceAuditRowOut] = []
    for audit, computer_name in q.all():
        # Pydantic model from_attributes=True permite construir direto do ORM, mas aqui
        # adicionamos computer_name.
        data: Dict[str, Any] = {
            "id": audit.id,
            "maintenance_id": audit.maintenance_id,
            "action": getattr(audit, "action", None),
            "computer_id": getattr(audit, "computer_id", None),
            "edited_at": audit.edited_at,
            "edited_by_username": audit.edited_by_username,
            "edited_by_display_name": audit.edited_by_display_name,
            "edited_by_role": audit.edited_by_role,
            "changes": audit.changes,
            "snapshot": getattr(audit, "snapshot", None),
            "computer_name": computer_name,
        }
        items.append(MaintenanceAuditRowOut(**data))

    return MaintenanceAuditListResponse(items=items, total=total, page=page, page_size=page_size)
