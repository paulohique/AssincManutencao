"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import type { DeviceComponent, DeviceDetail, DeviceMaintenance, DeviceNote } from "@/models/device";
import type { GlpiOpenTicketItem } from "@/models/glpi";
import type { Permissions, UserRole } from "@/models/auth";
import {
  createDeviceNote,
  createMaintenance,
  deleteDeviceNote,
  deleteMaintenance,
  getDeviceComponents,
  getDeviceDetail,
  getDeviceMaintenance,
  getDeviceNotes,
  listOpenGlpiTickets,
  updateDeviceNote,
  updateMaintenance
} from "@/services/deviceDetailService";

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return String(s).slice(0, 10);
}

function statusVariant(status?: string | null) {
  if (status === "Em Dia") return "ok";
  if (status === "Atrasada") return "late";
  if (status === "Pendente") return "pending";
  return "neutral";
}

function maintenanceSummary(description: string, maxLen = 140) {
  const raw = String(description || "");
  const singleLine = raw.replace(/\s+/g, " ").trim();
  if (!singleLine) return "—";
  if (singleLine.length <= maxLen) return singleLine;
  return `${singleLine.slice(0, maxLen).trimEnd()}…`;
}

export function DeviceDetailClient({
  deviceId,
  permissions,
  technicianName,
  role,
}: {
  deviceId: string;
  permissions?: Partial<Permissions>;
  technicianName?: string;
  role?: UserRole;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [components, setComponents] = useState<DeviceComponent[]>([]);
  const [notes, setNotes] = useState<DeviceNote[]>([]);
  const [maintenance, setMaintenance] = useState<DeviceMaintenance[]>([]);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [maintOpen, setMaintOpen] = useState(false);
  const [maintType, setMaintType] = useState<"Preventiva" | "Corretiva">("Preventiva");
  const [maintDescription, setMaintDescription] = useState("");
  const [maintPerformedAt, setMaintPerformedAt] = useState("");
  const [maintNextDays, setMaintNextDays] = useState(365);
  const [savingMaint, setSavingMaint] = useState(false);

  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<GlpiOpenTicketItem[]>([]);
  const [maintTicketId, setMaintTicketId] = useState<string>("");

  const [expandedMaintenanceId, setExpandedMaintenanceId] = useState<number | null>(null);

  const isAdmin = role === "admin";

  const [editMaintOpen, setEditMaintOpen] = useState(false);
  const [editingMaint, setEditingMaint] = useState<DeviceMaintenance | null>(null);
  const [editType, setEditType] = useState<"Preventiva" | "Corretiva">("Preventiva");
  const [editDescription, setEditDescription] = useState("");
  const [editPerformedAt, setEditPerformedAt] = useState("");
  const [editNextDays, setEditNextDays] = useState(365);
  const [savingEditMaint, setSavingEditMaint] = useState(false);

  const canAddNote = Boolean(permissions?.add_note);
  const canAddMaintenance = Boolean(permissions?.add_maintenance);

  function openEditMaintenance(m: DeviceMaintenance) {
    setEditingMaint(m);
    setEditType(m.maintenance_type);
    setEditDescription(m.description || "");
    setEditPerformedAt(String(m.performed_at || "").slice(0, 10));

    const performed = m.performed_at ? new Date(m.performed_at) : null;
    const nextDue = m.next_due ? new Date(m.next_due) : null;
    if (m.maintenance_type === "Preventiva" && performed && nextDue) {
      const diffMs = nextDue.getTime() - performed.getTime();
      const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      setEditNextDays(days);
    } else {
      setEditNextDays(365);
    }

    setEditMaintOpen(true);
  }

  async function onSaveEditMaintenance() {
    if (!editingMaint) return;
    if (!editDescription.trim()) return;
    if (!editPerformedAt) return;

    setSavingEditMaint(true);
    try {
      await updateMaintenance(editingMaint.id, {
        maintenance_type: editType,
        description: editDescription,
        performed_at: editPerformedAt,
        next_due_days: editType === "Preventiva" ? editNextDays : null,
      } as any);
      setEditMaintOpen(false);
      setEditingMaint(null);
      await refreshAll();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar manutenção");
    } finally {
      setSavingEditMaint(false);
    }
  }

  const maintenanceStatus = useMemo(() => {
    if (!device) return "Pendente";
    const next = device.next_maintenance ? new Date(device.next_maintenance) : null;
    if (!next) return "Pendente";
    return new Date() > next ? "Atrasada" : "Em Dia";
  }, [device]);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [d, c, n, m] = await Promise.all([
        getDeviceDetail(deviceId),
        getDeviceComponents(deviceId),
        getDeviceNotes(deviceId),
        getDeviceMaintenance(deviceId)
      ]);
      setDevice(d);
      setComponents(c);
      setNotes(n);
      setMaintenance(m);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    if (!maintOpen) return;
    if (ticketsLoading) return;
    if (tickets.length > 0) return;

    setTicketsLoading(true);
    setTicketsError(null);
    listOpenGlpiTickets()
      .then((res) => {
        setTickets(Array.isArray(res.items) ? res.items : []);
      })
      .catch((e: any) => {
        setTicketsError(e?.message ?? "Falha ao carregar chamados do GLPI");
      })
      .finally(() => setTicketsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintOpen]);

  async function onCreateNote() {
    if (!noteContent.trim()) return;
    setSavingNote(true);
    try {
      await createDeviceNote(deviceId, { content: noteContent });
      setNoteOpen(false);
      setNoteContent("");
      await refreshAll();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar nota");
    } finally {
      setSavingNote(false);
    }
  }

  async function onDeleteNote(noteId: number) {
    if (!confirm("Remover esta nota?")) return;
    try {
      await deleteDeviceNote(deviceId, noteId);
      await refreshAll();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao deletar nota");
    }
  }

  async function onEditNote(note: DeviceNote) {
    const next = prompt("Editar nota:", note.content);
    if (next == null) return;
    try {
      await updateDeviceNote(deviceId, note.id, { content: next });
      await refreshAll();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar nota");
    }
  }

  async function onCreateMaintenance() {
    if (!device) return;
    if (!maintDescription.trim()) return;
    if (!maintPerformedAt) return;
    if (!maintTicketId) return;

    setSavingMaint(true);
    try {
      await createMaintenance({
        computer_id: Number(device.id),
        maintenance_type: maintType,
        glpi_ticket_id: Number(maintTicketId),
        description: maintDescription,
        performed_at: new Date(maintPerformedAt).toISOString(),
        next_due_days: maintType === "Preventiva" ? maintNextDays : null
      });
      setMaintOpen(false);
      setMaintDescription("");
      setMaintPerformedAt("");
      setMaintTicketId("");
      await refreshAll();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar manutenção");
    } finally {
      setSavingMaint(false);
    }
  }

  const canSaveMaintenance = Boolean(maintPerformedAt && maintDescription.trim() && maintTicketId);

  async function onDeleteMaintenance(id: number) {
    if (!confirm("Remover este registro de manutenção?")) return;
    try {
      await deleteMaintenance(id);
      await refreshAll();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao deletar manutenção");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="flex items-center justify-between gap-3">
          <div>Erro: {error}</div>
          {String(error).toLowerCase().includes("não autenticado") ? (
            <Link className="underline font-semibold" href="/login">
              Ir para login
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  if (!device) {
    return <p className="text-sm text-muted-foreground">Dispositivo não encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="border-b border-gray-200 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nome</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{device.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Serial</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{device.serial ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Localização</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{device.location ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
              <Badge variant={statusVariant(maintenanceStatus) as any} className="mt-1">
                {maintenanceStatus}
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="components" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="components">Componentes</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
              <TabsTrigger value="maintenance">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="components" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Capacidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.component_type}</TableCell>
                      <TableCell>{c.name ?? "—"}</TableCell>
                      <TableCell>{c.model ?? "—"}</TableCell>
                      <TableCell>{c.serial ?? "—"}</TableCell>
                      <TableCell>{c.capacity ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {components.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                        Sem componentes importados ainda. Rode o sync.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="flex justify-end">
                {canAddNote ? (
                  <Button variant="primary" type="button" onClick={() => setNoteOpen(true)}>
                    Adicionar Nota
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem permissão para adicionar notas.</p>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Autor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead style={{ width: 180 }}>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>{n.author}</TableCell>
                      <TableCell>{fmtDate(n.created_at)}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{n.content}</TableCell>
                      <TableCell>
                        {canAddNote ? (
                          <div className="flex gap-2">
                            <Button variant="outline" type="button" onClick={() => onEditNote(n)}>
                              Editar
                            </Button>
                            <Button variant="destructive" type="button" onClick={() => onDeleteNote(n.id)}>
                              Remover
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {notes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-10">
                        Sem notas ainda.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              {canAddNote ? (
              <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Adicionar Nota</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div>
                      <label className="text-sm font-semibold">Conteúdo</label>
                      <div className="mt-2">
                        <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} className="min-h-[120px]" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" type="button" onClick={() => setNoteOpen(false)} disabled={savingNote}>
                      Cancelar
                    </Button>
                    <Button variant="primary" type="button" onClick={onCreateNote} disabled={savingNote}>
                      {savingNote ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              ) : null}
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-4">
              <div className="flex justify-end">
                {canAddMaintenance ? (
                  <Button variant="primary" type="button" onClick={() => setMaintOpen(true)}>
                    Adicionar Manutenção
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem permissão para registrar manutenção.</p>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chamado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Próxima</TableHead>
                    <TableHead style={{ width: 120 }}>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenance.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setExpandedMaintenanceId((cur) => (cur === m.id ? null : m.id));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedMaintenanceId((cur) => (cur === m.id ? null : m.id));
                        }
                      }}
                      tabIndex={0}
                      aria-expanded={expandedMaintenanceId === m.id}
                      title={expandedMaintenanceId === m.id ? "Clique para recolher" : "Clique para expandir"}
                    >
                      <TableCell>{m.glpi_ticket_id ? `#${m.glpi_ticket_id}` : "—"}</TableCell>
                      <TableCell>{m.maintenance_type}</TableCell>
                      <TableCell>{fmtDate(m.performed_at)}</TableCell>
                      <TableCell>{m.technician ?? "—"}</TableCell>
                      <TableCell className={expandedMaintenanceId === m.id ? "whitespace-pre-wrap" : ""}>
                        {expandedMaintenanceId === m.id
                          ? (m.description || "—")
                          : maintenanceSummary(m.description || "")}
                      </TableCell>
                      <TableCell>{fmtDate(m.next_due)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canAddMaintenance ? (
                            <Button
                              variant="outline"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditMaintenance(m);
                              }}
                            >
                              Editar
                            </Button>
                          ) : null}
                          {isAdmin ? (
                            <Button
                              variant="destructive"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteMaintenance(m.id);
                              }}
                            >
                              Remover
                            </Button>
                          ) : null}
                          {!canAddMaintenance && !isAdmin ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {maintenance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                        Sem manutenções ainda.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              {canAddMaintenance ? (
              <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
                <DialogContent className="sm:max-w-[640px]">
                  <DialogHeader>
                    <DialogTitle>Adicionar Manutenção</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-semibold">Tipo</label>
                        <div className="mt-2 flex gap-2">
                          <Button type="button" variant={maintType === "Preventiva" ? "primary" : "outline"} onClick={() => setMaintType("Preventiva")}>
                            Preventiva
                          </Button>
                          <Button type="button" variant={maintType === "Corretiva" ? "primary" : "outline"} onClick={() => setMaintType("Corretiva")}>
                            Corretiva
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold">Data Realizada</label>
                        <div className="mt-2">
                          <Input type="date" value={maintPerformedAt} onChange={(e) => setMaintPerformedAt(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold">Chamado GLPI (Computador) *</label>
                      <div className="mt-2">
                        <Select value={maintTicketId} onValueChange={setMaintTicketId}>
                          <SelectTrigger className="h-11">
                            <SelectValue
                              placeholder={ticketsLoading ? "Carregando chamados..." : "Selecione um chamado"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {ticketsLoading ? (
                              <SelectItem value="__loading" disabled>
                                Carregando...
                              </SelectItem>
                            ) : null}
                            {ticketsError && !ticketsLoading ? (
                              <SelectItem value="__error" disabled>
                                Erro ao carregar
                              </SelectItem>
                            ) : null}
                            {tickets.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                #{t.id}{t.title ? ` — ${t.title}` : ""}
                              </SelectItem>
                            ))}
                            {!ticketsLoading && tickets.length === 0 ? (
                              <SelectItem value="__empty" disabled>
                                Nenhum chamado aberto encontrado
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </div>
                      {ticketsError ? (
                        <p className="mt-2 text-sm text-red-600">{ticketsError}</p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-semibold">Técnico</label>
                        <div className="mt-2">
                          <Input value={technicianName || ""} disabled readOnly />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold">Próxima (dias)</label>
                        <div className="mt-2">
                          <Input
                            type="number"
                            min={1}
                            disabled={maintType !== "Preventiva"}
                            value={maintNextDays}
                            onChange={(e) => setMaintNextDays(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold">Descrição *</label>
                      <div className="mt-2">
                        <Textarea
                          value={maintDescription}
                          onChange={(e) => setMaintDescription(e.target.value)}
                          className="min-h-[120px]"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" type="button" onClick={() => setMaintOpen(false)} disabled={savingMaint}>
                      Cancelar
                    </Button>
                    <Button variant="primary" type="button" onClick={onCreateMaintenance} disabled={savingMaint || !canSaveMaintenance}>
                      {savingMaint ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              ) : null}

              {canAddMaintenance ? (
              <Dialog open={editMaintOpen} onOpenChange={setEditMaintOpen}>
                <DialogContent className="sm:max-w-[640px]">
                  <DialogHeader>
                    <DialogTitle>Editar Manutenção</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div>
                      <label className="text-sm font-semibold">Tipo</label>
                      <div className="mt-2 flex gap-2">
                        <Button type="button" variant={editType === "Preventiva" ? "primary" : "outline"} onClick={() => setEditType("Preventiva")}>
                          Preventiva
                        </Button>
                        <Button type="button" variant={editType === "Corretiva" ? "primary" : "outline"} onClick={() => setEditType("Corretiva")}>
                          Corretiva
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-semibold">Data Realizada</label>
                        <div className="mt-2">
                          <Input type="date" value={editPerformedAt} onChange={(e) => setEditPerformedAt(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold">Próxima (dias)</label>
                        <div className="mt-2">
                          <Input
                            type="number"
                            min={1}
                            disabled={editType !== "Preventiva"}
                            value={editNextDays}
                            onChange={(e) => setEditNextDays(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold">Descrição *</label>
                      <div className="mt-2">
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="min-h-[140px]"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" type="button" onClick={() => setEditMaintOpen(false)} disabled={savingEditMaint}>
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      type="button"
                      onClick={onSaveEditMaintenance}
                      disabled={savingEditMaint || !editDescription.trim() || !editPerformedAt}
                    >
                      {savingEditMaint ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              ) : null}
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  );
}
