-- Audit log for maintenance edits

CREATE TABLE IF NOT EXISTS maintenance_history_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  maintenance_id INT NOT NULL,
  edited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_by_username VARCHAR(255) NOT NULL,
  edited_by_display_name VARCHAR(255) NULL,
  edited_by_role VARCHAR(32) NULL,
  changes JSON NULL,
  CONSTRAINT fk_maintenance_audit_maintenance_id
    FOREIGN KEY (maintenance_id) REFERENCES maintenance_history(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_maintenance_audit_mid_date
  ON maintenance_history_audit (maintenance_id, edited_at);
