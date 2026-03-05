-- Extend maintenance audit log to support delete history and preserve rows

-- 1) Drop FK that cascades deletes (to keep audit rows after maintenance deletion)
SET @fk := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history_audit'
    AND REFERENCED_TABLE_NAME = 'maintenance_history'
  LIMIT 1
);

SET @sql := IF(
  @fk IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE maintenance_history_audit DROP FOREIGN KEY ', @fk)
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Add columns for action + computer + full snapshot
SET @has_action := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history_audit'
    AND COLUMN_NAME = 'action'
);
SET @sql := IF(
  @has_action = 0,
  "ALTER TABLE maintenance_history_audit ADD COLUMN action VARCHAR(20) NOT NULL DEFAULT 'update' AFTER maintenance_id",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_computer_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history_audit'
    AND COLUMN_NAME = 'computer_id'
);
SET @sql := IF(
  @has_computer_id = 0,
  "ALTER TABLE maintenance_history_audit ADD COLUMN computer_id INT NULL AFTER action",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_snapshot := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history_audit'
    AND COLUMN_NAME = 'snapshot'
);
SET @sql := IF(
  @has_snapshot = 0,
  "ALTER TABLE maintenance_history_audit ADD COLUMN snapshot JSON NULL",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_action := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history_audit'
    AND INDEX_NAME = 'idx_maintenance_audit_action_date'
);
SET @sql := IF(
  @has_idx_action = 0,
  'CREATE INDEX idx_maintenance_audit_action_date ON maintenance_history_audit (action, edited_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_comp := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history_audit'
    AND INDEX_NAME = 'idx_maintenance_audit_computer_date'
);
SET @sql := IF(
  @has_idx_comp = 0,
  'CREATE INDEX idx_maintenance_audit_computer_date ON maintenance_history_audit (computer_id, edited_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
