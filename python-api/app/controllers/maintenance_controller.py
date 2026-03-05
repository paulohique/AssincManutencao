from __future__ import annotations

import html

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import require_admin, require_permission
from app.integrations.glpi_client import GlpiClient

# Auth temporariamente desabilitada para rotas de escrita (manutenção).
# Para reativar no futuro, reintroduza `Depends(get_current_user)` nas rotas POST/PUT/DELETE.
from app.core.database import get_db
from app.schemas.schemas import MaintenanceAuditOut, MaintenanceCreate, MaintenanceOut, MaintenanceUpdate
from app.services.glpi_outbox_service import enqueue_followup, try_send_followup
from app.services.maintenance_service import create_maintenance, delete_maintenance, list_maintenance_audit, update_maintenance


router = APIRouter(tags=["maintenance"])


def _sanitize_followup_text(value: str) -> str:
    cleaned = (value or "").replace("\x00", "").strip()
    # Escape para evitar que o GLPI interprete HTML caso o campo seja renderizado.
    return html.escape(cleaned, quote=False)


@router.post("/api/maintenance", response_model=MaintenanceOut)
async def create_maintenance_endpoint(
    maintenance: MaintenanceCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permission("add_maintenance")),
):
    # Sempre atribui o técnico ao usuário autenticado.
    # Ignora qualquer valor enviado pelo cliente para evitar spoofing.
    technician = (user.get("display_name") or user.get("sub") or "").strip() or None
    if technician:
        try:
            maintenance.technician = technician  # pydantic mutável na prática (v1/v2 default)
        except Exception:
            # fallback para modelos imutáveis (caso alterem config)
            if hasattr(maintenance, "model_copy"):
                maintenance = maintenance.model_copy(update={"technician": technician})
            else:
                maintenance = maintenance.copy(update={"technician": technician})

    created = create_maintenance(db, maintenance)
    if not created:
        raise HTTPException(status_code=404, detail="Computador não encontrado")

    # Best-effort: comenta no chamado vinculado.
    try:
        msg_type = "preditiva" if created.maintenance_type == "Preventiva" else "corretiva"

        base_msg = f"Manutenção {msg_type} feita no devido computador"

        # Para manutenção corretiva, inclui também o texto digitado em Observação/Descrição.
        extra = ""
        if msg_type == "corretiva":
            desc = (maintenance.description or "").strip()
            if desc:
                extra = f"\n\nObservação registrada:\n{_sanitize_followup_text(desc)}"

        # Persistimos primeiro (outbox) para não perder a informação se o GLPI estiver fora.
        outbox = enqueue_followup(
            db,
            ticket_id=int(maintenance.glpi_ticket_id),
            content=base_msg + extra,
            maintenance_id=int(created.id),
        )

        # Tenta enviar imediatamente; se falhar, permanece como pending e pode ser reenviado depois.
        await try_send_followup(db, outbox.id)
    except Exception:
        # Não falha o registro local caso o GLPI esteja indisponível.
        pass

    return created


@router.put("/api/maintenance/{maintenance_id}", response_model=MaintenanceOut)
async def update_maintenance_endpoint(
    maintenance_id: int,
    payload: MaintenanceUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_permission("add_maintenance")),
):
    # Evita spoofing: somente admin pode alterar o campo technician.
    if user.get("role") != "admin" and payload.technician is not None:
        try:
            payload.technician = None
        except Exception:
            if hasattr(payload, "model_copy"):
                payload = payload.model_copy(update={"technician": None})
            else:
                payload = payload.copy(update={"technician": None})

    updated = update_maintenance(
        db,
        maintenance_id,
        payload,
        edited_by_username=(user.get("sub") or ""),
        edited_by_display_name=(user.get("display_name") or None),
        edited_by_role=(user.get("role") or None),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    return updated


@router.get("/api/maintenance/{maintenance_id}/audit", response_model=list[MaintenanceAuditOut])
async def list_maintenance_audit_endpoint(
    maintenance_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_admin),
):
    return list_maintenance_audit(db, maintenance_id)


@router.delete("/api/maintenance/{maintenance_id}")
async def delete_maintenance_endpoint(
    maintenance_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    deleted = delete_maintenance(
        db,
        maintenance_id,
        deleted_by_username=(user.get("sub") or ""),
        deleted_by_display_name=(user.get("display_name") or None),
        deleted_by_role=(user.get("role") or None),
    )
    if deleted is None:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    return {"status": "deleted"}
