import { getToken } from "@/lib/auth";
import { getPyApiBaseUrl } from "@/lib/py-api";

import type { AdminSettingsResponse, AdminSettingsUpdateRequest } from "@/models/settings";

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

export async function getAdminSettings(): Promise<AdminSettingsResponse> {
  const url = `${getBaseUrl()}/api/admin/settings`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  await throwIfNotOk(res, "Falha ao carregar configurações");
  return res.json();
}

export async function updateAdminSettings(payload: AdminSettingsUpdateRequest): Promise<AdminSettingsResponse> {
  const url = `${getBaseUrl()}/api/admin/settings`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(authHeaders() as any) },
    body: JSON.stringify(payload),
  });
  await throwIfNotOk(res, "Falha ao salvar configurações");
  return res.json();
}
