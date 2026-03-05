import { getDashboardMetrics } from "@/services/dashboardService";

export async function loadDashboardMetrics() {
  return getDashboardMetrics();
}
