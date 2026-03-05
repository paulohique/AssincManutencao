-- Exemplo para criar banco e usuário no MySQL/MariaDB (XAMPP)
-- Você pode rodar isso no phpMyAdmin (aba SQL).

CREATE DATABASE IF NOT EXISTS glpi_manutencao
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Ajuste o host conforme sua arquitetura:
-- - 'localhost' para tudo na mesma VM
-- - '%' para aceitar de qualquer host (use com cuidado)
CREATE USER IF NOT EXISTS 'glpi_user'@'localhost' IDENTIFIED BY 'UmaSenhaForte_Aqui_123';
ALTER USER 'glpi_user'@'localhost' IDENTIFIED BY 'UmaSenhaForte_Aqui_123';

GRANT ALL PRIVILEGES ON glpi_manutencao.* TO 'glpi_user'@'localhost';
FLUSH PRIVILEGES;
