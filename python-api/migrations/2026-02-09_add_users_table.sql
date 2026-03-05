-- Migração: adiciona tabela users (RBAC)
-- Data: 2026-02-09
-- Compatível com MySQL 8 / MariaDB (XAMPP)

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(255) NOT NULL,
  `password_hash` TEXT NULL,

  `display_name` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
  `groups` JSON NULL,

  `role` VARCHAR(32) NOT NULL DEFAULT 'user',

  `can_add_note` TINYINT(1) NOT NULL DEFAULT 0,
  `can_add_maintenance` TINYINT(1) NOT NULL DEFAULT 0,
  `can_generate_report` TINYINT(1) NOT NULL DEFAULT 0,
  `can_manage_permissions` TINYINT(1) NOT NULL DEFAULT 0,

  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Observação:
-- O usuário padrão admin/admin é criado automaticamente pela aplicação no startup.
