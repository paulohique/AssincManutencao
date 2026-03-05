"use client";

import { useMemo, useState } from "react";
import DOMPurify from "dompurify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import type { GlpiTicketAttachment, GlpiTicketDetail, GlpiTicketFollowup, GlpiTicketQueueItem } from "@/models/glpi";
import {
  addGlpiTicketFollowup,
  assignGlpiTicketToMe,
  getGlpiTicketDetail,
  listGlpiTicketAttachments,
  listGlpiTicketFollowups,
  listGlpiTicketQueue,
} from "@/services/glpiTicketsService";

function fmtDateTime(s?: string) {
  if (!s) return "—";
  // GLPI costuma mandar YYYY-MM-DD HH:mm:ss
  return String(s).replace("T", " ").slice(0, 16);
}

function statusVariant(label?: string) {
  const v = String(label || "").toLowerCase();
  if (v.includes("novo")) return "pending";
  if (v.includes("atribu")) return "ok";
  if (v.includes("pend")) return "late";
  return "neutral";
}

export function GlpiTicketsInboxClient({
  enabled,
  categoryLabel,
}: {
  enabled: boolean;
  categoryLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [items, setItems] = useState<GlpiTicketQueueItem[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<GlpiTicketDetail | null>(null);

  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [followupsError, setFollowupsError] = useState<string | null>(null);
  const [followups, setFollowups] = useState<GlpiTicketFollowup[]>([]);

  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<GlpiTicketAttachment[]>([]);

  const [newFollowup, setNewFollowup] = useState("");
  const [postingFollowup, setPostingFollowup] = useState(false);

  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const category = useMemo(() => "computador", []);
  const title = categoryLabel ? `Chamados GLPI (${categoryLabel})` : "Chamados GLPI";

  const safeDetailHtml = useMemo(() => {
    const raw = detail?.content || "";
    if (!raw) return "";
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
    });
  }, [detail?.content]);

  async function refreshQueue() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await listGlpiTicketQueue({ category, limit: 50 });
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar chamados do GLPI");
    } finally {
      setLoading(false);
    }
  }

  async function openInbox() {
    if (!enabled) return;
    setOpen(true);
    setSuccess(null);
    if (items.length === 0 && !loading) {
      await refreshQueue();
    }
  }

  async function openDetail(ticketId: number) {
    setSelectedId(ticketId);
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setSuccess(null);

    setFollowups([]);
    setFollowupsError(null);
    setFollowupsLoading(true);

    setAttachments([]);
    setAttachmentsError(null);
    setAttachmentsLoading(true);

    setNewFollowup("");
    try {
      const [d, fu, at] = await Promise.all([
        getGlpiTicketDetail(ticketId, { category }),
        listGlpiTicketFollowups(ticketId).catch((e: any) => ({ __error: e } as any)),
        listGlpiTicketAttachments(ticketId).catch((e: any) => ({ __error: e } as any)),
      ]);

      setDetail(d);

      if ((fu as any)?.__error) {
        setFollowupsError(((fu as any).__error?.message as string) || "Falha ao carregar acompanhamentos");
      } else {
        setFollowups(Array.isArray((fu as any)?.items) ? (fu as any).items : []);
      }

      if ((at as any)?.__error) {
        setAttachmentsError(((at as any).__error?.message as string) || "Falha ao carregar anexos");
      } else {
        setAttachments(Array.isArray((at as any)?.items) ? (at as any).items : []);
      }
    } catch (e: any) {
      setDetailError(e?.message ?? "Falha ao carregar detalhes do chamado");
    } finally {
      setDetailLoading(false);
      setFollowupsLoading(false);
      setAttachmentsLoading(false);
    }
  }

  async function postFollowup() {
    if (!detail?.id) return;
    const content = newFollowup.trim();
    if (!content) return;

    setPostingFollowup(true);
    setFollowupsError(null);
    setSuccess(null);
    try {
      await addGlpiTicketFollowup(detail.id, content);
      setNewFollowup("");
      setSuccess("Acompanhamento adicionado.");
      setFollowupsLoading(true);
      const fu = await listGlpiTicketFollowups(detail.id);
      setFollowups(Array.isArray(fu.items) ? fu.items : []);
    } catch (e: any) {
      setFollowupsError(e?.message ?? "Falha ao adicionar acompanhamento");
    } finally {
      setFollowupsLoading(false);
      setPostingFollowup(false);
    }
  }

  async function assignToMe(ticketId: number) {
    if (assigningId) return;
    setAssigningId(ticketId);
    setError(null);
    setDetailError(null);
    setSuccess(null);
    try {
      const res = await assignGlpiTicketToMe(ticketId, { category });
      const assigned = (res as any)?.assigned_to as string | null | undefined;
      const baseMsg = ((res as any)?.message as string | undefined) || "Atribuição solicitada";
      const msg = assigned ? `${baseMsg} • Técnico principal: ${assigned}` : baseMsg;
      setSuccess(msg);
      if (assigned) {
        setDetail((prev) => (prev && prev.id === ticketId ? { ...prev, assigned_to: assigned } : prev));
      }
      await refreshQueue();
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao atribuir chamado";
      setError(msg);
      if (detailOpen && detail?.id === ticketId) setDetailError(msg);
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <>
      <Button
        variant="primary"
        type="button"
        onClick={openInbox}
        disabled={!enabled}
      >
        {title}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Novos, atribuídos e não solucionados.
            </div>
            <Button variant="outline" type="button" onClick={refreshQueue} disabled={loading}>
              Atualizar
            </Button>
          </div>

          {success ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {success}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <div className="flex-1 min-h-0">
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 bg-white">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      <TableHead className="w-[90px]">ID</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="w-[160px]">Atualizado</TableHead>
                      <TableHead className="w-[170px]">Atribuído</TableHead>
                      <TableHead className="w-[180px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground">
                          Nenhum chamado encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((t) => (
                        <TableRow
                          key={t.id}
                          className={
                            selectedId === t.id
                              ? "bg-gray-50"
                              : "hover:bg-gray-50"
                          }
                        >
                          <TableCell className="font-semibold">#{t.id}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left underline underline-offset-2"
                              onClick={() => openDetail(t.id)}
                            >
                              {t.title || "(sem título)"}
                            </button>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Solicitante: {t.requester || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(t.status_label) as any}>
                              {t.status_label || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{fmtDateTime(t.updated_at)}</TableCell>
                          <TableCell className="text-sm">{t.assigned_to || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                type="button"
                                onClick={() => openDetail(t.id)}
                              >
                                Abrir
                              </Button>
                              <Button
                                variant="primary"
                                type="button"
                                onClick={() => assignToMe(t.id)}
                                disabled={assigningId === t.id}
                              >
                                {assigningId === t.id ? "Atribuindo..." : "Atribuir para mim"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {detail ? `Chamado #${detail.id}` : "Detalhes do chamado"}
            </DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {success}
            </div>
          ) : null}

          {detailError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {detailError}
            </div>
          ) : null}

          <div className="flex-1 min-h-0 overflow-y-auto">
          {detailLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : detail ? (
            <div className="space-y-3 pr-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(detail.status_label) as any}>
                  {detail.status_label || "—"}
                </Badge>
                <div className="text-sm text-muted-foreground">{detail.category || "—"}</div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900">{detail.title || "(sem título)"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Solicitante: {detail.requester || "—"} • Atribuído: {detail.assigned_to || "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Criado: {fmtDateTime(detail.created_at)} • Atualizado: {fmtDateTime(detail.updated_at)}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-sm font-semibold text-gray-900">Descrição</div>
                {safeDetailHtml ? (
                  <div
                    className="mt-2 text-sm text-gray-800 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_div]:mt-1 [&_p]:mt-1"
                    dangerouslySetInnerHTML={{ __html: safeDetailHtml }}
                  />
                ) : (
                  <div className="mt-2 text-sm text-gray-800">—</div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-sm font-semibold text-gray-900">Acompanhamentos</div>

                {followupsError ? (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {followupsError}
                  </div>
                ) : null}

                {followupsLoading ? (
                  <div className="mt-2 text-sm text-muted-foreground">Carregando acompanhamentos...</div>
                ) : followups.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-800">Nenhum acompanhamento.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {followups.map((f, idx) => (
                      <div key={(f.id ?? `idx-${idx}`) as any} className="rounded-md border border-gray-200 p-2">
                        <div className="text-xs text-muted-foreground">
                          {f.author || "—"} • {fmtDateTime(f.created_at || undefined)}
                        </div>
                        <div
                          className="mt-1 whitespace-pre-wrap text-sm text-gray-800 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_div]:mt-1 [&_p]:mt-1"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(f.content || "", {
                              USE_PROFILES: { html: true },
                            }),
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <div className="text-sm font-semibold text-gray-900">Adicionar acompanhamento</div>
                  <Textarea
                    className="mt-2"
                    rows={4}
                    value={newFollowup}
                    onChange={(e) => setNewFollowup(e.target.value)}
                    placeholder="Escreva um acompanhamento..."
                    disabled={postingFollowup}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="primary"
                      type="button"
                      onClick={postFollowup}
                      disabled={postingFollowup || !newFollowup.trim()}
                    >
                      {postingFollowup ? "Enviando..." : "Adicionar"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-sm font-semibold text-gray-900">Anexos</div>

                {attachmentsError ? (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {attachmentsError}
                  </div>
                ) : null}

                {attachmentsLoading ? (
                  <div className="mt-2 text-sm text-muted-foreground">Carregando anexos...</div>
                ) : attachments.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-800">Nenhum anexo.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {attachments.map((a, idx) => (
                      <div key={(a.id ?? `idx-${idx}`) as any} className="rounded-md border border-gray-200 p-2">
                        <div className="text-sm text-gray-900">
                          {a.name || a.filename || "(arquivo)"}
                        </div>
                        {a.filename ? (
                          <div className="mt-1 text-xs text-muted-foreground">{a.filename}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 text-xs text-muted-foreground">
                  (Somente visualização; upload/download não implementado.)
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Selecione um chamado.</div>
          )}
          </div>

          <DialogFooter>
            {detail?.id ? (
              <Button
                variant="primary"
                type="button"
                onClick={() => assignToMe(detail.id)}
                disabled={assigningId === detail.id}
              >
                {assigningId === detail.id ? "Atribuindo..." : "Atribuir para mim"}
              </Button>
            ) : null}
            <Button variant="outline" type="button" onClick={() => setDetailOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
