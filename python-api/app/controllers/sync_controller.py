from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import (
    get_current_user,
    require_admin,
    require_glpi_webhook_network,
    require_glpi_webhook_token,
)
from app.core.database import get_db
from app.schemas.schemas import GlpiPushComputersRequest, SyncResult, SyncStatus
from app.services.sync_service import (
    get_sync_status,
    is_sync_running,
    start_sync_background,
    start_sync_background_ids,
    sync_glpi_computers_by_ids_impl,
    sync_glpi_computers_impl,
)


router = APIRouter(tags=["sync"])


@router.post("/api/sync/glpi", response_model=SyncResult)
async def sync_glpi_computers(
    async_run: bool = Query(False, alias="async"),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    if async_run:
        if is_sync_running():
            return SyncResult(
                computers_synced=0,
                components_synced=0,
                message="Sincronização já em andamento. Consulte /api/sync/status.",
            )
        start_sync_background()
        return SyncResult(
            computers_synced=0,
            components_synced=0,
            message="Sincronização iniciada em background. Consulte /api/sync/status.",
        )

    try:
        return await sync_glpi_computers_impl(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na sincronização: {str(e)}")


@router.get("/api/sync/status", response_model=SyncStatus)
async def get_status(_user=Depends(get_current_user)):
    return get_sync_status()


@router.post("/api/webhook/glpi")
async def glpi_webhook(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    try:
        result = await sync_glpi_computers_impl(db)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/webhook/glpi/trigger")
async def glpi_webhook_trigger(
    async_run: bool = Query(True, alias="async"),
    db: Session = Depends(get_db),
    _system=Depends(require_glpi_webhook_token),
    _net=Depends(require_glpi_webhook_network),
):
    """Webhook protegido por token para disparar sincronização.

    Pensado para ser chamado por um plugin/cron dentro do GLPI, sem precisar login JWT.
    """

    if is_sync_running():
        return {"status": "running", "message": "Sincronização já em andamento"}

    if async_run:
        start_sync_background()
        return {"status": "accepted", "message": "Sincronização iniciada em background"}

    try:
        result = await sync_glpi_computers_impl(db)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/webhook/glpi/push")
async def glpi_webhook_push(
    payload: GlpiPushComputersRequest,
    async_run: bool = Query(True, alias="async"),
    db: Session = Depends(get_db),
    _system=Depends(require_glpi_webhook_token),
    _net=Depends(require_glpi_webhook_network),
):
    """Webhook incremental: recebe IDs do GLPI e sincroniza somente esses."""

    ids = [int(x) for x in (payload.computer_ids or []) if x is not None]
    ids = [x for x in ids if x > 0]

    if not ids:
        return {"status": "noop", "message": "Nenhum id enviado"}

    if is_sync_running():
        return {"status": "running", "message": "Sincronização já em andamento"}

    if async_run:
        start_sync_background_ids(ids)
        return {"status": "accepted", "message": f"Sincronização incremental iniciada ({len(ids)} ids)"}

    try:
        result = await sync_glpi_computers_by_ids_impl(db, computer_ids=ids)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
