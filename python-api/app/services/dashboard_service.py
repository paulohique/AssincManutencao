from __future__ import annotations

from datetime import datetime

from sqlalchemy import distinct, func, or_
from sqlalchemy.orm import Session

from app.models import Computer, MaintenanceHistory
from app.schemas.schemas import DashboardMetrics


def get_dashboard_metrics(db: Session) -> DashboardMetrics:
    now = datetime.utcnow()

    total_computers = int(db.query(func.count(Computer.id)).scalar() or 0)
    preventive_done_computers = int(
        db.query(func.count(Computer.id))
        .filter(Computer.last_maintenance.isnot(None))
        .scalar()
        or 0
    )

    status_pending = int(
        db.query(func.count(Computer.id)).filter(Computer.next_maintenance.is_(None)).scalar() or 0
    )
    status_late = int(
        db.query(func.count(Computer.id))
        .filter(Computer.next_maintenance.isnot(None), Computer.next_maintenance < now)
        .scalar()
        or 0
    )
    status_ok = int(
        db.query(func.count(Computer.id))
        .filter(Computer.next_maintenance.isnot(None), Computer.next_maintenance >= now)
        .scalar()
        or 0
    )

    corrective_open = int(
        db.query(func.count(Computer.id))
        .filter(or_(Computer.next_maintenance.is_(None), Computer.next_maintenance < now))
        .scalar()
        or 0
    )

    corrective_done_total = int(
        db.query(func.count(MaintenanceHistory.id))
        .filter(MaintenanceHistory.maintenance_type == "Corretiva")
        .scalar()
        or 0
    )

    corrective_done_computers = int(
        db.query(func.count(distinct(MaintenanceHistory.computer_id)))
        .filter(MaintenanceHistory.maintenance_type == "Corretiva")
        .scalar()
        or 0
    )

    return DashboardMetrics(
        total_computers=total_computers,
        preventive_done_computers=preventive_done_computers,
        preventive_needed_computers=total_computers,
        corrective_done_total=corrective_done_total,
        corrective_done_computers=corrective_done_computers,
        status_ok_computers=status_ok,
        status_late_computers=status_late,
        status_pending_computers=status_pending,
        corrective_open_computers=corrective_open,
    )
