from __future__ import annotations

from pydantic import BaseModel, Field


class GlpiAlertsSettings(BaseModel):
    enabled: bool = False
    unassigned_alert_days: int = Field(5, ge=1, le=365)
    stale_alert_days: int = Field(5, ge=1, le=365)


class AdminSettingsResponse(BaseModel):
    glpi_alerts: GlpiAlertsSettings


class AdminSettingsUpdateRequest(BaseModel):
    glpi_alerts: GlpiAlertsSettings
