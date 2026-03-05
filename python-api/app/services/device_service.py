from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import case, desc, exists, or_
from sqlalchemy.orm import Session
from sqlalchemy.sql import expression

from app.models import Computer, ComputerComponent, MaintenanceHistory
from app.schemas.schemas import DeviceDetail, DeviceRow, DevicesPage


def calculate_maintenance_status(
    last_maintenance: Optional[datetime],
    next_maintenance: Optional[datetime],
) -> str:
    if not next_maintenance:
        return "Pendente"

    now = datetime.utcnow()
    if now > next_maintenance:
        return "Atrasada"

    return "Em Dia"


def list_devices(
    db: Session,
    tab: str,
    page: int,
    page_size: int,
    q: Optional[str],
    status: Optional[str] = None,
    sort: str = "updated",
) -> DevicesPage:
    query = db.query(Computer)

    status = (status or "").strip() or None
    sort = (sort or "updated").strip() or "updated"

    if q:
        query = query.filter(
            or_(
                Computer.name.ilike(f"%{q}%"),
                Computer.patrimonio.ilike(f"%{q}%"),
                Computer.serial.ilike(f"%{q}%"),
                Computer.entity.ilike(f"%{q}%"),
            )
        )

    if tab == "preventiva":
        query = query.filter(Computer.last_maintenance.isnot(None))
    elif tab == "corretiva":
        query = query.filter(
            exists()
            .where(MaintenanceHistory.computer_id == Computer.id)
            .where(MaintenanceHistory.maintenance_type == "Corretiva")
        )

    now = datetime.utcnow()

    # Filtro por status (calculado via next_maintenance)
    if status == "Pendente":
        query = query.filter(Computer.next_maintenance.is_(None))
    elif status == "Atrasada":
        query = query.filter(Computer.next_maintenance.isnot(None)).filter(Computer.next_maintenance < now)
    elif status == "Em Dia":
        query = query.filter(Computer.next_maintenance.isnot(None)).filter(Computer.next_maintenance >= now)

    # Ordenação
    if sort == "name":
        order_expr: expression.ClauseElement = Computer.name.asc()
        query = query.order_by(order_expr, desc(Computer.updated_at))
    elif sort == "last_maintenance":
        query = query.order_by(desc(Computer.last_maintenance).nullslast(), desc(Computer.updated_at))
    elif sort == "next_maintenance":
        query = query.order_by(desc(Computer.next_maintenance).nullslast(), desc(Computer.updated_at))
    elif sort == "status":
        # Ordem pedida: Pendente -> Atrasada -> Em Dia
        status_rank = case(
            (Computer.next_maintenance.is_(None), 0),
            (Computer.next_maintenance < now, 1),
            else_=2,
        )
        query = query.order_by(status_rank.asc(), Computer.name.asc())
    else:
        # default: mais recentemente atualizado primeiro
        query = query.order_by(desc(Computer.updated_at))

    total = query.count()
    offset = (page - 1) * page_size
    computers = query.offset(offset).limit(page_size).all()

    items = []
    for comp in computers:
        status = calculate_maintenance_status(comp.last_maintenance, comp.next_maintenance)
        items.append(
            DeviceRow(
                id=comp.id,
                glpi_id=comp.glpi_id,
                name=comp.name,
                maintenance_status=status,
                last_maintenance=comp.last_maintenance.strftime("%Y-%m-%d")
                if comp.last_maintenance
                else None,
                next_maintenance=comp.next_maintenance.strftime("%Y-%m-%d")
                if comp.next_maintenance
                else None,
            )
        )

    return DevicesPage(items=items, page=page, page_size=page_size, total=total)


def get_device_detail(db: Session, device_id: int) -> Optional[DeviceDetail]:
    computer = db.query(Computer).filter(Computer.id == device_id).first()
    if not computer:
        return None
    return DeviceDetail.from_orm(computer)


def get_device_components(db: Session, device_id: int):
    return (
        db.query(ComputerComponent)
        .filter(ComputerComponent.computer_id == device_id)
        .all()
    )
