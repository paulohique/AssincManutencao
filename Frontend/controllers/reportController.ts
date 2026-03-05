import { getMaintenanceReport } from "@/services/reportService";
import { type MaintenanceReportQuery } from "@/models/report";

export async function loadMaintenanceReport(query: MaintenanceReportQuery) {
  return getMaintenanceReport(query);
}
