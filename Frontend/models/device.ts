export type MaintenanceStatus = "Em Dia" | "Atrasada" | "Pendente";

export type DeviceRow = {
  id: string;
  device_name: string;
  maintenance_status: MaintenanceStatus;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
};

export type DevicesQuery = {
  tab: "dispositivos" | "preventiva" | "corretiva";
  q: string;
  status?: MaintenanceStatus | "";
  sort?: "updated" | "name" | "status" | "last_maintenance" | "next_maintenance";
  page: number;
  pageSize: number;
};

export type DevicesPage = {
  items: DeviceRow[];
  page: number;
  pageSize: number;
  total: number;
};

// Tipos do backend (FastAPI) para o detalhe do dispositivo
export type DeviceDetail = {
  id: number;
  glpi_id: number;
  name: string;
  serial: string | null;
  location: string | null;
  entity: string | null;
  patrimonio: string | null;
  status: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
};

export type DeviceComponent = {
  id: number;
  computer_id: number;
  component_type: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  capacity: string | null;
  component_data?: any;
  created_at?: string;
};

export type DeviceNote = {
  id: number;
  computer_id: number;
  author: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type DeviceMaintenance = {
  id: number;
  computer_id: number;
  maintenance_type: "Preventiva" | "Corretiva";
  glpi_ticket_id?: number | null;
  description: string;
  performed_at: string;
  technician: string | null;
  next_due: string | null;
  created_at: string;
};

export type MaintenanceAuditEntry = {
  id: number;
  maintenance_id: number;
  edited_at: string;
  edited_by_username: string;
  edited_by_display_name?: string | null;
  edited_by_role?: string | null;
  changes?: Record<string, { from: any; to: any }> | null;
};
