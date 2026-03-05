from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.schemas.settings_schemas import AdminSettingsResponse, AdminSettingsUpdateRequest, GlpiAlertsSettings
from app.services.settings_service import get_bool_setting, get_int_setting, set_setting


router = APIRouter(tags=["admin"])


@router.get("/api/admin/settings", response_model=AdminSettingsResponse)
async def get_admin_settings(
    db: Session = Depends(get_db),
    _user=Depends(require_admin),
):
    glpi_alerts = GlpiAlertsSettings(
        enabled=get_bool_setting(db, "glpi_alerts_enabled", False),
        unassigned_alert_days=get_int_setting(db, "glpi_unassigned_alert_days", 5),
        stale_alert_days=get_int_setting(db, "glpi_stale_alert_days", 5),
    )

    return AdminSettingsResponse(glpi_alerts=glpi_alerts)


@router.put("/api/admin/settings", response_model=AdminSettingsResponse)
async def update_admin_settings(
    payload: AdminSettingsUpdateRequest,
    db: Session = Depends(get_db),
    _user=Depends(require_admin),
):
    set_setting(db, "glpi_alerts_enabled", "1" if bool(payload.glpi_alerts.enabled) else "0")
    set_setting(db, "glpi_unassigned_alert_days", str(payload.glpi_alerts.unassigned_alert_days))
    set_setting(db, "glpi_stale_alert_days", str(payload.glpi_alerts.stale_alert_days))
    db.commit()

    return await get_admin_settings(db=db, _user=_user)
