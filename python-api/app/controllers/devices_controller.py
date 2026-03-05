from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_permission

# Auth temporariamente desabilitada para rotas de escrita (notas/manutenções).
# Para reativar no futuro, reintroduza `Depends(get_current_user)` nas rotas POST/PUT/DELETE.
from app.core.database import get_db
from app.models import Computer
from app.schemas.schemas import (
    ComponentOut,
    DeviceDetail,
    DevicesPage,
    NoteCreate,
    NoteOut,
    NoteUpdate,
    MaintenanceOut,
)
from app.services.device_service import get_device_components, get_device_detail, list_devices
from app.services.maintenance_service import get_device_maintenance_history
from app.services.note_service import (
    create_device_note,
    delete_device_note,
    get_device_notes,
    update_device_note,
)


router = APIRouter(tags=["devices"])


@router.get("/api/devices", response_model=DevicesPage)
async def list_devices_endpoint(
    tab: str = Query("all", pattern="^(all|preventiva|corretiva)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: Optional[str] = None,
    status: Optional[str] = Query(None, pattern="^(Em Dia|Atrasada|Pendente)$"),
    sort: str = Query("updated", pattern="^(updated|name|status|last_maintenance|next_maintenance)$"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    return list_devices(db=db, tab=tab, page=page, page_size=page_size, q=q, status=status, sort=sort)


@router.get("/api/devices/{device_id}", response_model=DeviceDetail)
async def get_device_detail_endpoint(device_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    detail = get_device_detail(db, device_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return detail


@router.get("/api/devices/{device_id}/components", response_model=List[ComponentOut])
async def get_device_components_endpoint(device_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    computer = db.query(Computer).filter(Computer.id == device_id).first()
    if not computer:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return get_device_components(db, device_id)


@router.get("/api/devices/{device_id}/maintenance", response_model=List[MaintenanceOut])
async def get_device_maintenance_history_endpoint(device_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    computer = db.query(Computer).filter(Computer.id == device_id).first()
    if not computer:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return get_device_maintenance_history(db, device_id)


@router.get("/api/devices/{device_id}/notes", response_model=List[NoteOut])
async def get_device_notes_endpoint(device_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    computer = db.query(Computer).filter(Computer.id == device_id).first()
    if not computer:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return get_device_notes(db, device_id)


@router.post("/api/devices/{device_id}/notes", response_model=NoteOut)
async def create_device_note_endpoint(
    device_id: int,
    note: NoteCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permission("add_note")),
):
    author = str(user.get("display_name") or user.get("sub") or "Sistema")
    created = create_device_note(db, device_id, note, author=author)
    if not created:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return created


@router.put("/api/devices/{device_id}/notes/{note_id}", response_model=NoteOut)
async def update_device_note_endpoint(
    device_id: int,
    note_id: int,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("add_note")),
):
    updated = update_device_note(db, device_id, note_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    return updated


@router.delete("/api/devices/{device_id}/notes/{note_id}")
async def delete_device_note_endpoint(
    device_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("add_note")),
):
    ok = delete_device_note(db, device_id, note_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    return {"status": "deleted"}
