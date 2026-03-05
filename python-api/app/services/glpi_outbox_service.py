from __future__ import annotations

from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.glpi_client import GlpiClient
from app.models import GlpiFollowupOutbox


STATUS_PENDING = "pending"
STATUS_SENT = "sent"


def enqueue_followup(
    db: Session,
    *,
    ticket_id: int,
    content: str,
    maintenance_id: Optional[int] = None,
) -> GlpiFollowupOutbox:
    ticket_id = int(ticket_id)
    content = (content or "").strip()

    record = GlpiFollowupOutbox(
        maintenance_id=maintenance_id,
        ticket_id=ticket_id,
        content=content,
        status=STATUS_PENDING,
        attempts=0,
        last_error=None,
        created_at=datetime.utcnow(),
        sent_at=None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


async def try_send_followup(db: Session, outbox_id: int) -> Tuple[bool, Optional[str]]:
    record = db.query(GlpiFollowupOutbox).filter(GlpiFollowupOutbox.id == int(outbox_id)).first()
    if not record:
        return False, "outbox_not_found"

    if record.status == STATUS_SENT:
        return True, None

    record.attempts = int(record.attempts or 0) + 1
    db.commit()

    try:
        glpi = GlpiClient()
        if bool(getattr(settings, "GLPI_SEND_AS_SOLUTION", False)):
            solution_type_id = int(getattr(settings, "GLPI_SOLUTION_TYPE_ID", 0) or 0)
            await glpi.add_ticket_solution(
                int(record.ticket_id),
                record.content,
                solution_type_id=(solution_type_id if solution_type_id > 0 else None),
            )
        else:
            await glpi.add_ticket_followup(int(record.ticket_id), record.content)
    except Exception as e:
        record.last_error = str(e)
        db.commit()
        return False, str(e)

    record.status = STATUS_SENT
    record.sent_at = datetime.utcnow()
    record.last_error = None
    db.commit()
    return True, None


async def process_pending(db: Session, *, limit: int = 25) -> dict:
    limit = max(1, min(int(limit), 200))

    pending = (
        db.query(GlpiFollowupOutbox)
        .filter(GlpiFollowupOutbox.status == STATUS_PENDING)
        .order_by(GlpiFollowupOutbox.created_at.asc())
        .limit(limit)
        .all()
    )

    sent = 0
    failed = 0
    for r in pending:
        ok, _err = await try_send_followup(db, r.id)
        if ok:
            sent += 1
        else:
            failed += 1

    return {"processed": len(pending), "sent": sent, "failed": failed}
