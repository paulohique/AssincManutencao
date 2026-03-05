-- Adds generic key/value settings table

CREATE TABLE IF NOT EXISTS app_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(128) NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_app_settings_key (`key`),
  KEY idx_app_settings_key (`key`)
);

-- Defaults for GLPI alerts
INSERT INTO app_settings (`key`, `value`, updated_at)
VALUES
  ('glpi_alerts_enabled', '0', NOW()),
  ('glpi_unassigned_alert_days', '5', NOW()),
  ('glpi_stale_alert_days', '5', NOW())
ON DUPLICATE KEY UPDATE `value` = `value`;
