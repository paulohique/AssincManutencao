import { getToken } from "@/lib/auth";
import type { MeResponse } from "@/models/auth";
import { getPyApiBaseUrl } from "@/lib/py-api";

function getBaseUrl() {
  return getPyApiBaseUrl();
}

function authHeaders(): HeadersInit {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function getMe(): Promise<MeResponse> {
  const url = `${getBaseUrl()}/api/auth/me`;
  const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(res.status === 401 ? "Não autenticado" : `Erro: ${res.status}`);
  const data: any = await res.json();
  return {
    username: String(data?.username ?? ""),
    display_name: data?.display_name ?? null,
    email: data?.email ?? null,
    groups: Array.isArray(data?.groups) ? data.groups.map(String) : [],
    role: (data?.role === "admin" || data?.role === "auditor" || data?.role === "tecnico" || data?.role === "user") ? data.role : "user",
    permissions: (data?.permissions && typeof data.permissions === "object") ? data.permissions : {},
  };
}
