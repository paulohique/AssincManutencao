-- Reset da senha do usuário da aplicação (MySQL local)
-- Define a senha do usuário 'glpi_user'@'localhost' para '0000'

ALTER USER 'glpi_user'@'localhost' IDENTIFIED BY '0000';
FLUSH PRIVILEGES;
