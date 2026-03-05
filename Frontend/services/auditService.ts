import { getToken } from "@/lib/auth";
import { getPyApiBaseUrl } from "@/lib/py-api";

import type { MaintenanceAuditListResponse } from "@/models/audit";

function getBaseUrl() {
  return getPyApiBaseUrl();
}

function authHeaders(): HeadersInit {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
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
    return (await res.text()).trim();
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

export async function listMaintenanceAudit(params?: {
  page?: number;
  pageSize?: number;
  action?: string;
}): Promise<MaintenanceAuditListResponse> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 50;
  const action = params?.action;

  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("page_size", String(pageSize));
  if (action) qs.set("action", action);

  const url = `${getBaseUrl()}/api/audit/maintenance?${qs.toString()}`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao carregar auditoria");
  return res.json();
}
