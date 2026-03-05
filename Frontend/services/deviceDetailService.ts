import type {
  DeviceComponent,
  DeviceDetail,
  MaintenanceAuditEntry,
  DeviceMaintenance,
  DeviceNote
} from "@/models/device";

import type { GlpiOpenTicketsResponse } from "@/models/glpi";

import { getToken } from "@/lib/auth";
import { getPyApiBaseUrl } from "@/lib/py-api";

function getBaseUrl() {
  return getPyApiBaseUrl();
}

function authHeaders() {
  const token = getToken();
  if (!token) return {} as HeadersInit;
  return { Authorization: `Bearer ${token}` } as HeadersInit;
}

async function readApiErrorDetail(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const data: any = await res.json();
      if (data && typeof data === "object") {
        if (typeof data.detail === "string") return data.detail;
        if (typeof data.message === "string") return data.message;
        if (data.detail != null) return JSON.stringify(data.detail);
      }
      return JSON.stringify(data);
    }

    const text = (await res.text()).trim();
    return text;
  } catch {
    return "";
  }
}

async function throwIfNotOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  const detail = await readApiErrorDetail(res);
  const suffix = detail ? ` - ${detail}` : "";
  throw new Error(`${action}: ${res.status}${suffix}`);
}

export async function getDeviceDetail(deviceId: string): Promise<DeviceDetail> {
  const url = `${getBaseUrl()}/api/devices/${encodeURIComponent(deviceId)}`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao carregar device: ${res.status}`);
  return res.json();
}

export async function getDeviceComponents(deviceId: string): Promise<DeviceComponent[]> {
  const url = `${getBaseUrl()}/api/devices/${encodeURIComponent(deviceId)}/components`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao carregar componentes: ${res.status}`);
  return res.json();
}

export async function getDeviceNotes(deviceId: string): Promise<DeviceNote[]> {
  const url = `${getBaseUrl()}/api/devices/${encodeURIComponent(deviceId)}/notes`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao carregar notas: ${res.status}`);
  return res.json();
}

export async function createDeviceNote(deviceId: string, payload: { content: string }) {
  const url = `${getBaseUrl()}/api/devices/${encodeURIComponent(deviceId)}/notes`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authHeaders() as any) },
    body: JSON.stringify(payload)
  });
  // Temporário: desabilitado o erro específico de "Não autenticado" no frontend.
  // if (res.status === 401) throw new Error("Não autenticado. Faça login para criar notas.");
  await throwIfNotOk(res, "Falha ao criar nota");
  return res.json() as Promise<DeviceNote>;
}

export async function updateDeviceNote(
  deviceId: string,
  noteId: number,
  payload: { author?: string; content?: string }
) {
  const url = `${getBaseUrl()}/api/devices/${encodeURIComponent(deviceId)}/notes/${noteId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(authHeaders() as any) },
    body: JSON.stringify(payload)
  });
  // Temporário: desabilitado o erro específico de "Não autenticado" no frontend.
  // if (res.status === 401) throw new Error("Não autenticado. Faça login para editar notas.");
  await throwIfNotOk(res, "Falha ao atualizar nota");
  return res.json() as Promise<DeviceNote>;
}

export async function deleteDeviceNote(deviceId: string, noteId: number) {
  const url = `${getBaseUrl()}/api/devices/${encodeURIComponent(deviceId)}/notes/${noteId}`;
  const res = await fetch(url, { method: "DELETE", headers: authHeaders() });
  // Temporário: desabilitado o erro específico de "Não autenticado" no frontend.
  // if (res.status === 401) throw new Error("Não autenticado. Faça login para remover notas.");
  await throwIfNotOk(res, "Falha ao deletar nota");
}

export async function getDeviceMaintenance(deviceId: string): Promise<DeviceMaintenance[]> {
  const url = `${getBaseUrl()}/api/devices/${encodeURIComponent(deviceId)}/maintenance`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao carregar manutenções: ${res.status}`);
  return res.json();
}

export async function createMaintenance(payload: {
  computer_id: number;
  maintenance_type: "Preventiva" | "Corretiva";
  glpi_ticket_id: number;
  description: string;
  performed_at: string; // ISO
  technician?: string;
  next_due_days?: number | null;
}) {
  const url = `${getBaseUrl()}/api/maintenance`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authHeaders() as any) },
    body: JSON.stringify(payload)
  });
  // Temporário: desabilitado o erro específico de "Não autenticado" no frontend.
  // if (res.status === 401) throw new Error("Não autenticado. Faça login para criar manutenção.");
  await throwIfNotOk(res, "Falha ao criar manutenção");
  return res.json() as Promise<DeviceMaintenance>;
}

export async function listOpenGlpiTickets(): Promise<GlpiOpenTicketsResponse> {
  const url = `${getBaseUrl()}/api/glpi/tickets/open?category=computador&limit=20`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao listar chamados GLPI");
  return res.json();
}

export async function updateMaintenance(
  maintenanceId: number,
  payload: {
    maintenance_type?: "Preventiva" | "Corretiva";
    description?: string;
    performed_at?: string;
    technician?: string;
    next_due_days?: number | null;
  }
) {
  const url = `${getBaseUrl()}/api/maintenance/${maintenanceId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(authHeaders() as any) },
    body: JSON.stringify(payload)
  });
  // Temporário: desabilitado o erro específico de "Não autenticado" no frontend.
  // if (res.status === 401) throw new Error("Não autenticado. Faça login para atualizar manutenção.");
  await throwIfNotOk(res, "Falha ao atualizar manutenção");
  return res.json() as Promise<DeviceMaintenance>;
}

export async function deleteMaintenance(maintenanceId: number) {
  const url = `${getBaseUrl()}/api/maintenance/${maintenanceId}`;
  const res = await fetch(url, { method: "DELETE", headers: authHeaders() });
  // Temporário: desabilitado o erro específico de "Não autenticado" no frontend.
  // if (res.status === 401) throw new Error("Não autenticado. Faça login para deletar manutenção.");
  await throwIfNotOk(res, "Falha ao deletar manutenção");
}

export async function getMaintenanceAudit(maintenanceId: number): Promise<MaintenanceAuditEntry[]> {
  const url = `${getBaseUrl()}/api/maintenance/${maintenanceId}/audit`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao carregar log de manutenção");
  return res.json();
}
