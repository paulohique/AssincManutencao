import { type DashboardMetrics } from "@/models/dashboard";

import { serverAuthHeaders } from "@/lib/auth-server";
import { getPyApiBaseUrl } from "@/lib/py-api";

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  let py: string;
  try {
    py = getPyApiBaseUrl();
  } catch {
    return null;
  }

  try {
    const url = new URL(`${py}/api/dashboard/metrics`);
    const res = await fetch(url.toString(), { cache: "no-store", headers: serverAuthHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      total_computers: Number(data.total_computers ?? 0),
      preventive_done_computers: Number(data.preventive_done_computers ?? 0),
      preventive_needed_computers: Number(data.preventive_needed_computers ?? 0),
      corrective_done_total: Number(data.corrective_done_total ?? 0),
      corrective_done_computers: Number(data.corrective_done_computers ?? 0),
      status_ok_computers: Number(data.status_ok_computers ?? 0),
      status_late_computers: Number(data.status_late_computers ?? 0),
      status_pending_computers: Number(data.status_pending_computers ?? 0),
      corrective_open_computers: Number(data.corrective_open_computers ?? 0)
    };
  } catch {
    return null;
  }
}
