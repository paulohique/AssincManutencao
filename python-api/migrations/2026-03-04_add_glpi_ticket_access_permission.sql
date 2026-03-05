-- Migração: adiciona permissão de acesso aos chamados GLPI
-- Data: 2026-03-04
-- Compatível com MySQL 8 / MariaDB (XAMPP)

ALTER TABLE `users`
  ADD COLUMN `can_access_glpi_tickets` TINYINT(1) NOT NULL DEFAULT 0
  AFTER `can_manage_permissions`;
