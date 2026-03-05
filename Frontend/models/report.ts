export type MaintenanceTypeFilter = "Preventiva" | "Corretiva" | "Ambas";

export type MaintenanceReportRow = {
  computer_id: number;
  computer_name: string;
  computer_entity?: string | null;
  patrimonio: string | null;
  serial?: string | null;
  location?: string | null;
  technician: string | null;
  maintenance_type: "Preventiva" | "Corretiva";
  glpi_ticket_id?: number | null;
  description?: string | null;
  performed_at: string; // ISO
};

export type MaintenanceReportTopTechnician = {
  technician: string;
  total: number;
};

export type MaintenanceReportSummary = {
  total_records: number;
  total_computers: number;
  total_technicians: number;
  totals_by_type: Record<string, number>;
  top_technicians: MaintenanceReportTopTechnician[];
};

export type MaintenanceReportResponse = {
  items: MaintenanceReportRow[];
  total: number;
  page?: number;
  page_size?: number;
  summary?: MaintenanceReportSummary | null;
};

export type MaintenanceReportQuery = {
  from?: string;
  to?: string;
  maintenance_type?: MaintenanceTypeFilter;
  q?: string;
  technician?: string;
  has_ticket?: boolean;
  page?: number;
  page_size?: number;
};
