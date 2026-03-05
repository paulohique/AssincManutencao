"use client";

import { PiePanel } from "@/components/dashboard/PiePanel";
import { type DashboardMetrics } from "@/models/dashboard";

function clampNonNegative(n: number) {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function DashboardPies({ metrics }: { metrics: DashboardMetrics | null }) {
  const total = clampNonNegative(metrics?.total_computers ?? 0);
  const preventiveDone = clampNonNegative(metrics?.preventive_done_computers ?? 0);
  const preventiveNeeded = clampNonNegative(metrics?.preventive_needed_computers ?? 0);
  const preventivePending = clampNonNegative(preventiveNeeded - preventiveDone);

  const ok = clampNonNegative(metrics?.status_ok_computers ?? 0);
  const late = clampNonNegative(metrics?.status_late_computers ?? 0);
  const pending = clampNonNegative(metrics?.status_pending_computers ?? 0);

  const correctiveDoneDevices = clampNonNegative(metrics?.corrective_done_computers ?? 0);
  const correctiveNeverDevices = clampNonNegative(total - correctiveDoneDevices);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <PiePanel
        title="Preventiva (dispositivos)"
        subtitle="Concluída vs pendente"
        data={[
          { name: "Concluída", value: preventiveDone, color: "#22C55E" },
          { name: "Pendente", value: preventivePending, color: "#F59E0B" },
        ]}
      />

      <PiePanel
        title="Status de manutenção"
        subtitle="Em dia / atrasada / pendente"
        data={[
          { name: "Em Dia", value: ok, color: "#3B82F6" },
          { name: "Atrasada", value: late, color: "#EF4444" },
          { name: "Pendente", value: pending, color: "#F59E0B" },
        ]}
      />

      <PiePanel
        title="Corretiva (dispositivos)"
        subtitle="Já teve corretiva vs nunca teve"
        data={[
          { name: "Já teve", value: correctiveDoneDevices, color: "#8B5CF6" },
          { name: "Nunca teve", value: correctiveNeverDevices, color: "#94A3B8" },
        ]}
      />
    </div>
  );
}
