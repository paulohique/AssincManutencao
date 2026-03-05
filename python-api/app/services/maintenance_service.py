from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Computer, MaintenanceHistory, MaintenanceHistoryAudit

from app.schemas.schemas import MaintenanceCreate, MaintenanceUpdate


def _json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, datetime):
        # ISO sem microssegundos deixa o log mais legível
        return value.replace(microsecond=0).isoformat()
    return value


def _maintenance_snapshot(record: MaintenanceHistory) -> Dict[str, Any]:
    return {
        "id": int(record.id),
        "computer_id": int(record.computer_id),
        "maintenance_type": record.maintenance_type,
        "glpi_ticket_id": record.glpi_ticket_id,
        "description": record.description,
        "performed_at": _json_safe(record.performed_at),
        "technician": record.technician,
        "next_due": _json_safe(record.next_due),
        "created_at": _json_safe(record.created_at),
        "updated_at": _json_safe(record.updated_at),
    }


def create_maintenance(db: Session, maintenance: MaintenanceCreate) -> Optional[MaintenanceHistory]:
    computer = db.query(Computer).filter(Computer.id == maintenance.computer_id).first()
    if not computer:
        return None

    next_due = None
    if maintenance.maintenance_type == "Preventiva" and maintenance.next_due_days:
        next_due = maintenance.performed_at + timedelta(days=maintenance.next_due_days)

    maintenance_record = MaintenanceHistory(
        computer_id=maintenance.computer_id,
        maintenance_type=maintenance.maintenance_type,
        glpi_ticket_id=maintenance.glpi_ticket_id,
        description=maintenance.description,
        performed_at=maintenance.performed_at,
        technician=maintenance.technician,
        next_due=next_due,
    )
    db.add(maintenance_record)

    computer.last_maintenance = maintenance.performed_at
    computer.next_maintenance = next_due

    db.commit()
    db.refresh(maintenance_record)
    return maintenance_record


def get_device_maintenance_history(db: Session, device_id: int):
    return (
        db.query(MaintenanceHistory)
        .filter(MaintenanceHistory.computer_id == device_id)
        .order_by(desc(MaintenanceHistory.performed_at))
        .all()
    )

def update_maintenance(
    db: Session,
    maintenance_id: int,
    payload: MaintenanceUpdate,
    *,
    edited_by_username: str,
    edited_by_display_name: Optional[str] = None,
    edited_by_role: Optional[str] = None,
) -> Optional[MaintenanceHistory]:
    record = db.query(MaintenanceHistory).filter(MaintenanceHistory.id == maintenance_id).first()
    if not record:
        return None

    before_full = _maintenance_snapshot(record)

    if payload.maintenance_type is not None:
        record.maintenance_type = payload.maintenance_type
    if payload.description is not None:
        record.description = payload.description
    if payload.performed_at is not None:
        record.performed_at = payload.performed_at
    if payload.technician is not None:
        record.technician = payload.technician

    next_due = record.next_due
    if record.maintenance_type == "Preventiva" and payload.next_due_days is not None:
        next_due = record.performed_at + timedelta(days=payload.next_due_days)
    if record.maintenance_type != "Preventiva":
        next_due = None
    record.next_due = next_due
    record.updated_at = datetime.utcnow()

    after_full = _maintenance_snapshot(record)

    # Monta diff só com o que mudou.
    changes: Dict[str, Dict[str, Any]] = {}
    # Diff continua existindo (UI antiga), mas também guardamos snapshot completo.
    changes: Dict[str, Dict[str, Any]] = {}
    for k, b in before_full.items():
        a = after_full.get(k)
        if b != a:
            changes[k] = {"from": _json_safe(b), "to": _json_safe(a)}

    computer = db.query(Computer).filter(Computer.id == record.computer_id).first()
    if computer:
        computer.last_maintenance = record.performed_at
        computer.next_maintenance = next_due
        computer.updated_at = datetime.utcnow()

    if changes:
        audit = MaintenanceHistoryAudit(
            maintenance_id=int(record.id),
            action="update",
            computer_id=int(record.computer_id),
            edited_by_username=(edited_by_username or "").strip() or "unknown",
            edited_by_display_name=(edited_by_display_name or None),
            edited_by_role=(edited_by_role or None),
            changes=changes,
            snapshot={"before": before_full, "after": after_full},
        )
        db.add(audit)

    db.commit()
    db.refresh(record)
    return record


def list_maintenance_audit(db: Session, maintenance_id: int):
    maintenance_id = int(maintenance_id)
    if maintenance_id <= 0:
        return []
    return (
        db.query(MaintenanceHistoryAudit)
        .filter(MaintenanceHistoryAudit.maintenance_id == maintenance_id)
        .order_by(desc(MaintenanceHistoryAudit.edited_at))
        .all()
    )


def delete_maintenance(
    db: Session,
    maintenance_id: int,
    *,
    deleted_by_username: str,
    deleted_by_display_name: Optional[str] = None,
    deleted_by_role: Optional[str] = None,
) -> Optional[int]:
    record = db.query(MaintenanceHistory).filter(MaintenanceHistory.id == maintenance_id).first()
    if not record:
        return None

    before_full = _maintenance_snapshot(record)

    # Para exclusão, mantemos um snapshot completo e um diff "from -> None".
    changes: Dict[str, Dict[str, Any]] = {}
    for k, b in before_full.items():
        changes[k] = {"from": _json_safe(b), "to": None}

    audit = MaintenanceHistoryAudit(
        maintenance_id=int(record.id),
        action="delete",
        computer_id=int(record.computer_id),
        edited_by_username=(deleted_by_username or "").strip() or "unknown",
        edited_by_display_name=(deleted_by_display_name or None),
        edited_by_role=(deleted_by_role or None),
        changes=changes,
        snapshot={"before": before_full, "after": None},
    )
    db.add(audit)
    db.flush()

    computer_id = record.computer_id
    db.delete(record)
    db.commit()

    computer = db.query(Computer).filter(Computer.id == computer_id).first()
    if computer:
        latest = (
            db.query(MaintenanceHistory)
            .filter(MaintenanceHistory.computer_id == computer_id)
            .order_by(desc(MaintenanceHistory.performed_at))
            .first()
        )
        if latest:
            computer.last_maintenance = latest.performed_at
            computer.next_maintenance = latest.next_due
        else:
            computer.last_maintenance = None
            computer.next_maintenance = None
        computer.updated_at = datetime.utcnow()
        db.commit()

    return computer_id
