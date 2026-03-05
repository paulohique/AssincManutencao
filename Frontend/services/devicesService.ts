import { type DevicesPage, type DevicesQuery, type DeviceRow } from "@/models/device";

import { serverAuthHeaders } from "@/lib/auth-server";
import { getPyApiBaseUrl } from "@/lib/py-api";

function includesCI(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function filterByTab(items: DeviceRow[], tab: DevicesQuery["tab"]) {
  if (tab === "preventiva") {
    return items.filter((x) => x.last_maintenance_date !== null);
  }
  if (tab === "corretiva") {
    return items.filter((x) => x.maintenance_status !== "Em Dia");
  }
  return items;
}

export async function getDevices(query: DevicesQuery): Promise<DevicesPage> {
  let py: string;
  try {
    py = getPyApiBaseUrl();
  } catch {
    console.warn("NEXT_PUBLIC_PY_API_URL não configurada. Configure a variável de ambiente para consumir dados do GLPI.");
    return {
      items: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0
    };
  }
  
  try {
    const tabParam = query.tab === "dispositivos" ? "all" : query.tab;
    const url = new URL(`${py}/api/devices`);
    url.searchParams.set("tab", tabParam);
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("page_size", String(query.pageSize));
    if (query.q) url.searchParams.set("q", query.q);
    if (query.status) url.searchParams.set("status", query.status);
    if (query.sort) url.searchParams.set("sort", query.sort);

    const res = await fetch(url.toString(), { cache: "no-store", headers: serverAuthHeaders() });
    
    if (!res.ok) {
      console.error(`Erro ao buscar dispositivos: ${res.status} ${res.statusText}`);
      return {
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0
      };
    }

    const data = await res.json();
    const items = (data.items ?? []).map((r: any, idx: number) => {
      const status = String(r.maintenance_status ?? "Pendente");
      const mapStatus =
        status === "Em Dia" || status === "Atrasada" || status === "Pendente"
          ? status
          : "Pendente";
      return {
        id: String(r.id ?? idx),
        device_name: r.name ?? `GLPI-${r.glpi_id}`,
        maintenance_status: mapStatus,
        last_maintenance_date: r.last_maintenance
          ? String(r.last_maintenance).slice(0, 10)
          : null,
        next_maintenance_date: r.next_maintenance
          ? String(r.next_maintenance).slice(0, 10)
          : null
      };
    });
    
    return {
      items,
      page: data.page ?? query.page,
      pageSize: data.page_size ?? query.pageSize,
      total: data.total ?? items.length
    };
  } catch (error) {
    console.error("Erro ao consumir API do backend:", error);
    return {
      items: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0
    };
  }
}
