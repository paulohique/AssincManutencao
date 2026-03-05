import type { MeResponse } from "@/models/auth";
import { serverAuthHeaders } from "@/lib/auth-server";
import { getPyApiBaseUrl } from "@/lib/py-api";

export async function getMeServer(): Promise<MeResponse | null> {
  let py: string;
  try {
    py = getPyApiBaseUrl();
  } catch {
    return null;
  }

  try {
    const res = await fetch(`${py}/api/auth/me`, {
      cache: "no-store",
      headers: serverAuthHeaders(),
    });

    if (!res.ok) return null;
    const data: any = await res.json();

    return {
      username: String(data?.username ?? ""),
      display_name: data?.display_name ?? null,
      email: data?.email ?? null,
      groups: Array.isArray(data?.groups) ? data.groups.map(String) : [],
      role: data?.role === "admin" || data?.role === "auditor" || data?.role === "tecnico" || data?.role === "user" ? data.role : "user",
      permissions: data?.permissions && typeof data.permissions === "object" ? data.permissions : {},
    };
  } catch {
    return null;
  }
}
