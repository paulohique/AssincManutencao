-- Ensure computers.glpi_id is unique.
-- This prevents duplicate computers across repeated/concurrent sync runs.

-- 1) Detect existing duplicates (must be resolved before adding UNIQUE)
SELECT glpi_id, COUNT(*) AS qty
FROM computers
GROUP BY glpi_id
HAVING COUNT(*) > 1;

-- 2) Add UNIQUE only if the index does not already exist
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'computers'
    AND index_name = 'uq_computers_glpi_id'
);

SET @ddl := IF(
  @idx_exists = 0,
  'ALTER TABLE computers ADD UNIQUE KEY uq_computers_glpi_id (glpi_id)',
  'SELECT ''unique index uq_computers_glpi_id already exists'' AS message'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
