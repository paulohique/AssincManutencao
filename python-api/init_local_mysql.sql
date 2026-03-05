-- Inicialização do MySQL local (Windows)
-- Ajuste usuário/senha se quiser.

CREATE DATABASE IF NOT EXISTS glpi_manutencao
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Cria usuário específico da aplicação
CREATE USER IF NOT EXISTS 'glpi_user'@'localhost' IDENTIFIED BY '0000';

-- Garante a senha desejada mesmo se o usuário já existir
ALTER USER 'glpi_user'@'localhost' IDENTIFIED BY '0000';

GRANT ALL PRIVILEGES ON glpi_manutencao.* TO 'glpi_user'@'localhost';

FLUSH PRIVILEGES;

-- Migrações (quando atualizar versão do código):
-- Rode os scripts em python-api/migrations/ no banco glpi_manutencao.
