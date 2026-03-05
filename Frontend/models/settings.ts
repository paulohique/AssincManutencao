export type GlpiAlertsSettings = {
  enabled: boolean;
  unassigned_alert_days: number;
  stale_alert_days: number;
};

export type AdminSettingsResponse = {
  glpi_alerts: GlpiAlertsSettings;
};

export type AdminSettingsUpdateRequest = {
  glpi_alerts: GlpiAlertsSettings;
};
