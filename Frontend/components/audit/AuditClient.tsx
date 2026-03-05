"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { MaintenanceAuditEntry } from "@/models/audit";
import { listMaintenanceAudit } from "@/services/auditService";

function fmtDateTime(s?: string) {
  if (!s) return "—";
  return String(s).replace("T", " ").slice(0, 19);
}

function actionVariant(action?: string | null) {
  const a = String(action || "").toLowerCase();
  if (a === "delete") return "late";
  if (a === "update") return "ok";
  return "neutral";
}

function actionLabel(action?: string | null) {
  const a = String(action || "").toLowerCase();
  if (a === "delete") return "Exclusão";
  if (a === "update") return "Alteração";
  return action || "—";
}

function extractObservationBefore(it: MaintenanceAuditEntry): string {
  const snap: any = it.snapshot || null;
  const before = snap?.before || null;
  const v = before?.description;
  if (typeof v === "string") return v;

  // Fallback para logs antigos: tenta pelo diff
  const d: any = (it.changes as any)?.description;
  return typeof d?.from === "string" ? d.from : "";
}

function extractObservationAfter(it: MaintenanceAuditEntry): string {
  const snap: any = it.snapshot || null;
  const after = snap?.after || null;
  const v = after?.description;
  if (typeof v === "string") return v;

  // Fallback para logs antigos: tenta pelo diff
  const d: any = (it.changes as any)?.description;
  return typeof d?.to === "string" ? d.to : "";
}

function summarize(text: string, maxLen = 160) {
  const raw = String(text || "").trim();
  if (!raw) return "—";
  const single = raw.replace(/\s+/g, " ").trim();
  if (single.length <= maxLen) return single;
  return `${single.slice(0, maxLen).trimEnd()}…`;
}

function isBlank(text: string) {
  return !String(text || "").trim();
}

export function AuditClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [items, setItems] = useState<MaintenanceAuditEntry[]>([]);
  const [total, setTotal] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<MaintenanceAuditEntry | null>(null);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function load(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await listMaintenanceAudit({ page: nextPage, pageSize });
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(Number(res.total || 0));
      setPage(Number(res.page || nextPage));
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detail = useMemo(() => {
    if (!detailEntry) return null;
    const action = String(detailEntry.action || "").toLowerCase();
    const before = extractObservationBefore(detailEntry);
    const after = extractObservationAfter(detailEntry);
    return {
      action,
      before,
      after,
      hasBefore: !isBlank(before),
      hasAfter: !isBlank(after),
    };
  }, [detailEntry]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
      <Dialog
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setDetailEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Observação completa</DialogTitle>
          </DialogHeader>

          {detail ? (
            <div className="space-y-4 text-sm">
              {detail.action === "update" ? (
                <>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Antes</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-3">
                      {detail.hasBefore ? detail.before : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Depois</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-3">
                      {detail.hasAfter ? detail.after : "—"}
                    </div>
                  </div>
                </>
              ) : (
                <div className="whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-3">
                  {detail.hasAfter ? detail.after : detail.hasBefore ? detail.before : "—"}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">—</div>
          )}
        </DialogContent>
      </Dialog>

      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6">
        <h3 className="text-lg font-bold text-gray-900">Auditoria</h3>
        <p className="mt-1 text-sm text-gray-600">Histórico de alterações e exclusões (admin).</p>
      </div>

      <div className="p-6 space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-gray-900">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => load(page)} disabled={loading}>
              {loading ? "Carregando…" : "Recarregar"}
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">Quando</TableHead>
                <TableHead className="w-[110px]">Ação</TableHead>
                <TableHead>Computador</TableHead>
                <TableHead className="w-[120px]">Manutenção</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead>Quem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const who = it.edited_by_display_name || it.edited_by_username;
                const action = String(it.action || "").toLowerCase();

                const obsBefore = extractObservationBefore(it);
                const obsAfter = extractObservationAfter(it);

                const hasBefore = Boolean(String(obsBefore || "").trim());
                const hasAfter = Boolean(String(obsAfter || "").trim());
                const hasObs = hasBefore || hasAfter;
                return (
                  <TableRow key={it.id}>
                    <TableCell>{fmtDateTime(it.edited_at)}</TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(it.action) as any}>{actionLabel(it.action)}</Badge>
                    </TableCell>
                    <TableCell>{it.computer_name || (it.computer_id ? `#${it.computer_id}` : "—")}</TableCell>
                    <TableCell className="font-mono">#{it.maintenance_id}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {action === "update" ? (
                          <div className="space-y-1">
                            <div className="whitespace-pre-wrap">
                              <span className="font-semibold">Antes:</span> {summarize(obsBefore)}
                            </div>
                            <div className="whitespace-pre-wrap">
                              <span className="font-semibold">Depois:</span> {summarize(obsAfter)}
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{summarize(hasAfter ? obsAfter : obsBefore)}</div>
                        )}

                        {hasObs ? (
                          <div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => {
                                setDetailEntry(it);
                                setDetailOpen(true);
                              }}
                            >
                              Ver completo
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{who}</TableCell>
                  </TableRow>
                );
              })}

              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                    {loading ? "Carregando…" : "Sem registros."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            Página <span className="font-semibold text-gray-900">{page}</span> / {pages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={loading || page <= 1}
              onClick={async () => {
                const next = Math.max(1, page - 1);
                await load(next);
              }}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={loading || page >= pages}
              onClick={async () => {
                const next = Math.min(pages, page + 1);
                await load(next);
              }}
            >
              Próximo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
