"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { GlpiAlertsSettings } from "@/models/settings";
import { getAdminSettings, updateAdminSettings } from "@/services/adminSettingsService";

function clampInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function AdminSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [glpiAlerts, setGlpiAlerts] = useState<GlpiAlertsSettings>({
    enabled: false,
    unassigned_alert_days: 5,
    stale_alert_days: 5,
  });

  const isValid = useMemo(() => {
    const ua = clampInt(glpiAlerts.unassigned_alert_days, 5, 1, 365);
    const st = clampInt(glpiAlerts.stale_alert_days, 5, 1, 365);
    return ua >= 1 && ua <= 365 && st >= 1 && st <= 365;
  }, [glpiAlerts]);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await getAdminSettings();
      const s = data?.glpi_alerts;
      setGlpiAlerts({
        enabled: Boolean(s?.enabled),
        unassigned_alert_days: clampInt(s?.unassigned_alert_days, 5, 1, 365),
        stale_alert_days: clampInt(s?.stale_alert_days, 5, 1, 365),
      });
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        glpi_alerts: {
          enabled: Boolean(glpiAlerts.enabled),
          unassigned_alert_days: clampInt(glpiAlerts.unassigned_alert_days, 5, 1, 365),
          stale_alert_days: clampInt(glpiAlerts.stale_alert_days, 5, 1, 365),
        },
      };
      const res = await updateAdminSettings(payload);
      const s = res?.glpi_alerts;
      setGlpiAlerts({
        enabled: Boolean(s?.enabled),
        unassigned_alert_days: clampInt(s?.unassigned_alert_days, 5, 1, 365),
        stale_alert_days: clampInt(s?.stale_alert_days, 5, 1, 365),
      });
      setSuccess("Configurações salvas");
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar configurações");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6">
        <h3 className="text-lg font-bold text-gray-900">Configurações</h3>
        <p className="mt-1 text-sm text-gray-600">Ajustes de alertas GLPI (SLA) e pop-ups.</p>
      </div>

      <div className="p-6 space-y-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <input
                id="glpi-alerts-enabled"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300"
                checked={glpiAlerts.enabled}
                onChange={(e) => setGlpiAlerts((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <div className="flex-1">
                <label htmlFor="glpi-alerts-enabled" className="text-sm font-semibold text-gray-900">
                  Ativar SLA de pop-up (alertas)
                </label>
                <div className="text-xs text-muted-foreground">
                  Por padrão fica desativado. Ao ativar, técnicos podem receber pop-ups de tickets sem atribuição ou sem movimentação.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-gray-900">Sem atribuição (dias)</div>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={glpiAlerts.unassigned_alert_days}
                  disabled={!glpiAlerts.enabled}
                  onChange={(e) => setGlpiAlerts((prev) => ({ ...prev, unassigned_alert_days: clampInt(e.target.value, 5, 1, 365) }))}
                />
                <div className="text-xs text-muted-foreground">Tickets abertos sem responsável há N dias (desde a criação).</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold text-gray-900">Sem movimentação (dias)</div>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={glpiAlerts.stale_alert_days}
                  disabled={!glpiAlerts.enabled}
                  onChange={(e) => setGlpiAlerts((prev) => ({ ...prev, stale_alert_days: clampInt(e.target.value, 5, 1, 365) }))}
                />
                <div className="text-xs text-muted-foreground">Tickets abertos sem atualização há N dias (date_mod).</div>
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
            ) : null}
            {success ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={save} disabled={saving || loading || !isValid}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="outline" onClick={load} disabled={saving || loading}>
                Recarregar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
