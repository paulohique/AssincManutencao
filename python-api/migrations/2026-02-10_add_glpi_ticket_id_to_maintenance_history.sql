-- Add GLPI ticket linkage to maintenance_history
-- Safe for existing rows: column is NULLable.

ALTER TABLE maintenance_history
  ADD COLUMN glpi_ticket_id INT NULL;

CREATE INDEX idx_maintenance_glpi_ticket_id
  ON maintenance_history (glpi_ticket_id);
