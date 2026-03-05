export type MaintenanceAuditAction = "update" | "delete" | string;

export type MaintenanceAuditEntry = {
  id: number;
  maintenance_id: number;
  action?: MaintenanceAuditAction | null;
  computer_id?: number | null;
  computer_name?: string | null;
  edited_at: string;
  edited_by_username: string;
  edited_by_display_name?: string | null;
  edited_by_role?: string | null;
  changes?: Record<string, { from?: any; to?: any }> | null;
  snapshot?: Record<string, any> | null;
};

export type MaintenanceAuditListResponse = {
  items: MaintenanceAuditEntry[];
  total: number;
  page: number;
  page_size: number;
};
