"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { GlpiTicketAlertItem, GlpiTicketAlertsResponse } from "@/models/glpi";
import { listGlpiTicketAlerts } from "@/services/glpiTicketsService";

function fmtDateTime(s?: string) {
  if (!s) return "—";
  return String(s).replace("T", " ").slice(0, 16);
}

function pickUnassignedLabel(threshold: number) {
  return `Sem atribuição (≥ ${threshold}d)`;
}

function pickStaleLabel(threshold: number) {
  return `Sem movimentação (≥ ${threshold}d)`;
}

export function GlpiSlaAlertsPopupClient({
  enabled,
  category,
}: {
  enabled: boolean;
  category?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GlpiTicketAlertsResponse | null>(null);

  const thresholds = data?.thresholds ?? { unassigned_days: 5, stale_days: 5 };

  const total = useMemo(() => {
    return (data?.total_unassigned ?? 0) + (data?.total_stale ?? 0);
  }, [data?.total_unassigned, data?.total_stale]);

  async function refresh() {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listGlpiTicketAlerts({ category: category ?? "computador" });
      setData(res);
      if (res.enabled && ((res.total_unassigned ?? 0) > 0 || (res.total_stale ?? 0) > 0)) {
        setOpen(true);
      }
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar alertas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={refresh} disabled={loading} title="Checar alertas">
        {loading ? "Checando…" : "Alertas"}
        {total > 0 ? <Badge className="ml-2" variant="late">{total}</Badge> : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Alertas GLPI (SLA)</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-6">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
            ) : null}

            {!data ? (
              <div className="text-sm text-muted-foreground">Nenhum dado carregado.</div>
            ) : !data.enabled ? (
              <div className="text-sm text-muted-foreground">Alertas desativados pelo administrador.</div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{pickUnassignedLabel(thresholds.unassigned_days)}</div>
                    <Badge variant={(data.total_unassigned ?? 0) > 0 ? "late" : "neutral"}>{data.total_unassigned ?? 0}</Badge>
                  </div>

                  {(data.unassigned?.length ?? 0) === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum ticket nessa condição.</div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[110px]">Ticket</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead className="w-[160px]">Criado</TableHead>
                            <TableHead className="w-[140px]">Dias</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(data.unassigned ?? []).slice(0, 50).map((it: GlpiTicketAlertItem) => (
                            <TableRow key={`u-${it.id}`}>
                              <TableCell className="font-mono">#{it.id}</TableCell>
                              <TableCell>{it.title}</TableCell>
                              <TableCell>{fmtDateTime(it.created_at)}</TableCell>
                              <TableCell>
                                <Badge variant="late">{it.age_days ?? "—"}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{pickStaleLabel(thresholds.stale_days)}</div>
                    <Badge variant={(data.total_stale ?? 0) > 0 ? "late" : "neutral"}>{data.total_stale ?? 0}</Badge>
                  </div>

                  {(data.stale?.length ?? 0) === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum ticket nessa condição.</div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[110px]">Ticket</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead className="w-[160px]">Atualizado</TableHead>
                            <TableHead className="w-[140px]">Dias</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(data.stale ?? []).slice(0, 50).map((it: GlpiTicketAlertItem) => (
                            <TableRow key={`s-${it.id}`}>
                              <TableCell className="font-mono">#{it.id}</TableCell>
                              <TableCell>{it.title}</TableCell>
                              <TableCell>{fmtDateTime(it.updated_at)}</TableCell>
                              <TableCell>
                                <Badge variant="late">{it.stale_days ?? "—"}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              Recarregar
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
