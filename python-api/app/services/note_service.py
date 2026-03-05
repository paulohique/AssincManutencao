from __future__ import annotations

from datetime import datetime

from sqlalchemy import desc
from sqlalchemy.orm import Session

from typing import Optional

from app.models import Computer, ComputerNote
from app.schemas.schemas import NoteCreate, NoteUpdate


def get_device_notes(db: Session, device_id: int):
    return (
        db.query(ComputerNote)
        .filter(ComputerNote.computer_id == device_id)
        .order_by(desc(ComputerNote.created_at))
        .all()
    )


def create_device_note(
    db: Session,
    device_id: int,
    note: NoteCreate,
    *,
    author: str,
) -> Optional[ComputerNote]:
    computer = db.query(Computer).filter(Computer.id == device_id).first()
    if not computer:
        return None

    note_record = ComputerNote(computer_id=device_id, author=author or "Sistema", content=note.content)
    db.add(note_record)
    db.commit()
    db.refresh(note_record)
    return note_record


def update_device_note(
    db: Session,
    device_id: int,
    note_id: int,
    payload: NoteUpdate,
) -> Optional[ComputerNote]:
    note = (
        db.query(ComputerNote)
        .filter(ComputerNote.id == note_id, ComputerNote.computer_id == device_id)
        .first()
    )
    if not note:
        return None

    if payload.content is not None:
        note.content = payload.content
    note.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(note)
    return note


def delete_device_note(db: Session, device_id: int, note_id: int) -> bool:
    note = (
        db.query(ComputerNote)
        .filter(ComputerNote.id == note_id, ComputerNote.computer_id == device_id)
        .first()
    )
    if not note:
        return False

    db.delete(note)
    db.commit()
    return True
