from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import distinct, func, or_
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Computer, MaintenanceHistory
from app.schemas.report_schemas import (
    MaintenanceReportResponse,
    MaintenanceReportRow,
    MaintenanceReportSummary,
    MaintenanceReportTopTechnician,
)


def _dt_start(d: date) -> datetime:
    return datetime.combine(d, time.min)


def _dt_end(d: date) -> datetime:
    # inclusive end-of-day
    return datetime.combine(d, time.max)


def _apply_filters(
    query,
    *,
    from_date: Optional[date],
    to_date: Optional[date],
    maintenance_type: Optional[str],
    q: Optional[str],
    technician: Optional[str],
    has_ticket: Optional[bool],
):
    if from_date is not None:
        query = query.filter(MaintenanceHistory.performed_at >= _dt_start(from_date))

    if to_date is not None:
        query = query.filter(MaintenanceHistory.performed_at <= _dt_end(to_date))

    if maintenance_type and maintenance_type in {"Preventiva", "Corretiva"}:
        query = query.filter(MaintenanceHistory.maintenance_type == maintenance_type)

    if technician:
        tech = technician.strip()
        if tech:
            query = query.filter(MaintenanceHistory.technician.ilike(f"%{tech}%"))

    if has_ticket is True:
        query = query.filter(MaintenanceHistory.glpi_ticket_id.isnot(None))
    elif has_ticket is False:
        query = query.filter(MaintenanceHistory.glpi_ticket_id.is_(None))

    if q:
        text = q.strip()
        if text:
            like = f"%{text}%"
            query = query.filter(
                or_(
                    Computer.name.ilike(like),
                    Computer.patrimonio.ilike(like),
                    Computer.serial.ilike(like),
                    Computer.location.ilike(like),
                    MaintenanceHistory.description.ilike(like),
                )
            )

    return query


def get_maintenance_report(
    db: Session,
    *,
    from_date: Optional[date],
    to_date: Optional[date],
    maintenance_type: Optional[str],
    q: Optional[str] = None,
    technician: Optional[str] = None,
    has_ticket: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
) -> MaintenanceReportResponse:
    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 50), 500))

    base = (
        db.query(MaintenanceHistory, Computer)
        .join(Computer, Computer.id == MaintenanceHistory.computer_id)
    )

    base = _apply_filters(
        base,
        from_date=from_date,
        to_date=to_date,
        maintenance_type=maintenance_type,
        q=q,
        technician=technician,
        has_ticket=has_ticket,
    )

    total = base.order_by(None).count()

    rows = (
        base.order_by(desc(MaintenanceHistory.performed_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        MaintenanceReportRow(
            computer_id=computer.id,
            computer_name=computer.name,
            computer_entity=computer.entity,
            patrimonio=computer.patrimonio,
            serial=computer.serial,
            location=computer.location,
            technician=mh.technician,
            maintenance_type=mh.maintenance_type,
            glpi_ticket_id=mh.glpi_ticket_id,
            description=mh.description,
            performed_at=mh.performed_at,
        )
        for (mh, computer) in rows
    ]

    # Summary (same filters, no pagination)
    # Totals by type
    type_rows = (
        _apply_filters(
            db.query(MaintenanceHistory.maintenance_type, func.count(MaintenanceHistory.id))
            .join(Computer, Computer.id == MaintenanceHistory.computer_id),
            from_date=from_date,
            to_date=to_date,
            maintenance_type=maintenance_type,
            q=q,
            technician=technician,
            has_ticket=has_ticket,
        )
        .group_by(MaintenanceHistory.maintenance_type)
        .all()
    )

    totals_by_type = {str(t): int(c) for (t, c) in type_rows if t}

    total_computers = (
        _apply_filters(
            db.query(func.count(distinct(MaintenanceHistory.computer_id)))
            .join(Computer, Computer.id == MaintenanceHistory.computer_id),
            from_date=from_date,
            to_date=to_date,
            maintenance_type=maintenance_type,
            q=q,
            technician=technician,
            has_ticket=has_ticket,
        )
        .scalar()
        or 0
    )

    total_technicians = (
        _apply_filters(
            db.query(func.count(distinct(MaintenanceHistory.technician)))
            .join(Computer, Computer.id == MaintenanceHistory.computer_id),
            from_date=from_date,
            to_date=to_date,
            maintenance_type=maintenance_type,
            q=q,
            technician=technician,
            has_ticket=has_ticket,
        )
        .filter(MaintenanceHistory.technician.isnot(None))
        .scalar()
        or 0
    )

    top_tech_rows = (
        _apply_filters(
            db.query(MaintenanceHistory.technician, func.count(MaintenanceHistory.id))
            .join(Computer, Computer.id == MaintenanceHistory.computer_id),
            from_date=from_date,
            to_date=to_date,
            maintenance_type=maintenance_type,
            q=q,
            technician=technician,
            has_ticket=has_ticket,
        )
        .filter(MaintenanceHistory.technician.isnot(None))
        .group_by(MaintenanceHistory.technician)
        .order_by(desc(func.count(MaintenanceHistory.id)))
        .limit(5)
        .all()
    )

    top_technicians = [
        MaintenanceReportTopTechnician(technician=str(name), total=int(count))
        for (name, count) in top_tech_rows
        if name
    ]

    summary = MaintenanceReportSummary(
        total_records=int(total),
        total_computers=int(total_computers),
        total_technicians=int(total_technicians),
        totals_by_type=totals_by_type,
        top_technicians=top_technicians,
    )

    return MaintenanceReportResponse(
        items=items,
        total=int(total),
        page=page,
        page_size=page_size,
        summary=summary,
    )
