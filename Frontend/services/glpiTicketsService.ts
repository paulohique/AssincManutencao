import { getToken } from "@/lib/auth";
import { getPyApiBaseUrl } from "@/lib/py-api";

import type {
  GlpiTicketAttachmentsResponse,
  GlpiTicketAlertsResponse,
  GlpiTicketDetail,
  GlpiTicketFollowupsResponse,
  GlpiTicketQueueResponse,
} from "@/models/glpi";

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

export async function listGlpiTicketQueue(params?: {
  category?: string;
  limit?: number;
}): Promise<GlpiTicketQueueResponse> {
  const category = params?.category ?? "computador";
  const limit = params?.limit ?? 50;
  const url = `${getBaseUrl()}/api/glpi/tickets/queue?category=${encodeURIComponent(category)}&limit=${encodeURIComponent(String(limit))}`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao listar chamados do GLPI");
  return res.json();
}

export async function listGlpiTicketAlerts(params?: {
  category?: string;
}): Promise<GlpiTicketAlertsResponse> {
  const category = params?.category ?? "computador";
  const url = `${getBaseUrl()}/api/glpi/tickets/alerts?category=${encodeURIComponent(category)}`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao carregar alertas do GLPI");
  return res.json();
}

export async function getGlpiTicketDetail(ticketId: number, params?: { category?: string }): Promise<GlpiTicketDetail> {
  const category = params?.category ?? "computador";
  const url = `${getBaseUrl()}/api/glpi/tickets/${encodeURIComponent(String(ticketId))}?category=${encodeURIComponent(category)}`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao carregar detalhes do chamado");
  return res.json();
}

export async function assignGlpiTicketToMe(ticketId: number, params?: { category?: string }) {
  const category = params?.category ?? "computador";
  const url = `${getBaseUrl()}/api/glpi/tickets/${encodeURIComponent(String(ticketId))}/assign-to-me?category=${encodeURIComponent(category)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authHeaders() as any) },
  });
  await throwIfNotOk(res, "Falha ao atribuir chamado");
  return res.json() as Promise<{ ok: boolean; message?: string; assigned_to?: string | null }>;
}

export async function listGlpiTicketFollowups(ticketId: number): Promise<GlpiTicketFollowupsResponse> {
  const url = `${getBaseUrl()}/api/glpi/tickets/${encodeURIComponent(String(ticketId))}/followups`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao listar acompanhamentos do chamado");
  return res.json();
}

export async function addGlpiTicketFollowup(ticketId: number, content: string): Promise<{ ok: boolean }> {
  const url = `${getBaseUrl()}/api/glpi/tickets/${encodeURIComponent(String(ticketId))}/followups`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authHeaders() as any) },
    body: JSON.stringify({ content }),
  });
  await throwIfNotOk(res, "Falha ao adicionar acompanhamento");
  return res.json();
}

export async function listGlpiTicketAttachments(ticketId: number): Promise<GlpiTicketAttachmentsResponse> {
  const url = `${getBaseUrl()}/api/glpi/tickets/${encodeURIComponent(String(ticketId))}/attachments`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao listar anexos do chamado");
  return res.json();
}
