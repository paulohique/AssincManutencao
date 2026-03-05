import { getToken } from "@/lib/auth";
import type { UserAdminRow, UserRole } from "@/models/auth";
import { getPyApiBaseUrl } from "@/lib/py-api";

function getBaseUrl() {
  return getPyApiBaseUrl();
}

function authHeaders(): HeadersInit {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function readDetail(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data: any = await res.json();
      return typeof data?.detail === "string" ? data.detail : JSON.stringify(data);
    }
    return (await res.text()).trim();
  } catch {
    return "";
  }
}

export async function listUsers(): Promise<UserAdminRow[]> {
  const url = `${getBaseUrl()}/api/users`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) {
    const detail = await readDetail(res);
    throw new Error(detail || `Erro ao listar usuários: ${res.status}`);
  }
  const data: any = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((u: any) => ({
    username: String(u?.username ?? ""),
    display_name: u?.display_name ?? null,
    email: u?.email ?? null,
    role: (u?.role === "admin" || u?.role === "auditor" || u?.role === "tecnico" || u?.role === "user") ? u.role : "user",
    permissions: (u?.permissions && typeof u.permissions === "object") ? u.permissions : {},
  }));
}

export async function updateUserAccess(username: string, payload: {
  role: UserRole;
  add_note: boolean;
  add_maintenance: boolean;
  generate_report: boolean;
  manage_permissions: boolean;
  access_glpi_tickets: boolean;
}): Promise<UserAdminRow> {
  const url = `${getBaseUrl()}/api/users/${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(authHeaders() as any) },
    body: JSON.stringify({
      role: payload.role,
      add_note: payload.add_note,
      add_maintenance: payload.add_maintenance,
      generate_report: payload.generate_report,
      manage_permissions: payload.manage_permissions,
      access_glpi_tickets: payload.access_glpi_tickets,
    })
  });
  if (!res.ok) {
    const detail = await readDetail(res);
    throw new Error(detail || `Erro ao atualizar: ${res.status}`);
  }
  const u: any = await res.json();
  return {
    username: String(u?.username ?? ""),
    display_name: u?.display_name ?? null,
    email: u?.email ?? null,
    role: (u?.role === "admin" || u?.role === "auditor" || u?.role === "tecnico" || u?.role === "user") ? u.role : "user",
    permissions: (u?.permissions && typeof u.permissions === "object") ? u.permissions : {},
  };
}
