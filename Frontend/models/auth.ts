export type UserRole = "admin" | "auditor" | "tecnico" | "user";

export type Permissions = {
  add_note: boolean;
  add_maintenance: boolean;
  generate_report: boolean;
  manage_permissions: boolean;
  access_glpi_tickets: boolean;
};

export type MeResponse = {
  username: string;
  display_name?: string | null;
  email?: string | null;
  groups?: string[];
  role: UserRole;
  permissions: Partial<Permissions>;
};

export type UserAdminRow = {
  username: string;
  display_name?: string | null;
  email?: string | null;
  role: UserRole;
  permissions: Partial<Permissions>;
};
