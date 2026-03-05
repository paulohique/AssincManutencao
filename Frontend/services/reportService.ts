import { type MaintenanceReportQuery, type MaintenanceReportResponse } from "@/models/report";

import { serverAuthHeaders } from "@/lib/auth-server";
import { getPyApiBaseUrl } from "@/lib/py-api";

export async function getMaintenanceReport(
  query: MaintenanceReportQuery
): Promise<MaintenanceReportResponse | null> {
  let py: string;
  try {
    py = getPyApiBaseUrl();
  } catch {
    return null;
  }

  try {
    const url = new URL(`${py}/api/reports/maintenance`);
    if (query.from) url.searchParams.set("from", query.from);
    if (query.to) url.searchParams.set("to", query.to);
    if (query.maintenance_type && query.maintenance_type !== "Ambas") {
      url.searchParams.set("maintenance_type", query.maintenance_type);
    }
    if (query.q) url.searchParams.set("q", query.q);
    if (query.technician) url.searchParams.set("technician", query.technician);
    if (typeof query.has_ticket === "boolean") {
      url.searchParams.set("has_ticket", query.has_ticket ? "true" : "false");
    }
    if (query.page) url.searchParams.set("page", String(query.page));
    if (query.page_size) url.searchParams.set("page_size", String(query.page_size));

    const res = await fetch(url.toString(), { cache: "no-store", headers: serverAuthHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      total: Number(data.total ?? 0),
      page: Number(data.page ?? 1),
      page_size: Number(data.page_size ?? 50),
      summary: data.summary
        ? {
            total_records: Number(data.summary.total_records ?? 0),
            total_computers: Number(data.summary.total_computers ?? 0),
            total_technicians: Number(data.summary.total_technicians ?? 0),
            totals_by_type:
              data.summary.totals_by_type && typeof data.summary.totals_by_type === "object"
                ? data.summary.totals_by_type
                : {},
            top_technicians: Array.isArray(data.summary.top_technicians)
              ? data.summary.top_technicians.map((t: any) => ({
                  technician: String(t.technician ?? ""),
                  total: Number(t.total ?? 0),
                }))
              : [],
          }
        : null,
      items: Array.isArray(data.items)
        ? data.items.map((it: any) => ({
            computer_id: Number(it.computer_id),
            computer_name: String(it.computer_name ?? ""),
            computer_entity: it.computer_entity != null ? String(it.computer_entity) : null,
            patrimonio: it.patrimonio != null ? String(it.patrimonio) : null,
            serial: it.serial != null ? String(it.serial) : null,
            location: it.location != null ? String(it.location) : null,
            technician: it.technician != null ? String(it.technician) : null,
            maintenance_type: it.maintenance_type === "Corretiva" ? "Corretiva" : "Preventiva",
            glpi_ticket_id: it.glpi_ticket_id != null ? Number(it.glpi_ticket_id) : null,
            description: it.description != null ? String(it.description) : null,
            performed_at: String(it.performed_at),
          }))
        : [],
    };
  } catch {
    return null;
  }
}
