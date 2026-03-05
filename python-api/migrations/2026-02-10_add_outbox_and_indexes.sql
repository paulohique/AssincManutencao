-- Outbox para follow-up do GLPI (evita perder mensagem quando GLPI estiver fora)
CREATE TABLE IF NOT EXISTS glpi_followup_outbox (
  id INT AUTO_INCREMENT PRIMARY KEY,
  maintenance_id INT NULL,
  ticket_id INT NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  INDEX idx_outbox_status_created (status, created_at),
  INDEX idx_outbox_ticket_id (ticket_id),
  INDEX idx_outbox_maintenance_id (maintenance_id)
);

-- Índices para acelerar histórico por dispositivo
CREATE INDEX idx_maintenance_computer_performed_at ON maintenance_history (computer_id, performed_at);
CREATE INDEX idx_notes_computer_created_at ON computer_notes (computer_id, created_at);
