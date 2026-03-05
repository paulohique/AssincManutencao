"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { UserAdminRow, UserRole } from "@/models/auth";
import { getMe } from "@/services/authService";
import { listUsers, updateUserAccess } from "@/services/usersAdminService";

function toBool(v: any) {
  return Boolean(v);
}

export function AdminPermissionsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserAdminRow[]>([]);
  const [savingUser, setSavingUser] = useState<string | null>(null);

  const [changeOpen, setChangeOpen] = useState(false);
  const [changeTitle, setChangeTitle] = useState<string>("");
  const [changeLines, setChangeLines] = useState<string[]>([]);

  function permLabel(key: string) {
    if (key === "add_note") return "Adicionar nota";
    if (key === "add_maintenance") return "Adicionar manutenção";
    if (key === "access_glpi_tickets") return "Acessar chamados GLPI";
    if (key === "generate_report") return "Gerar relatório";
    if (key === "manage_permissions") return "Gerenciar permissões";
    return key;
  }

  function roleLabel(role: UserRole) {
    if (role === "admin") return "Administrador";
    if (role === "auditor") return "Auditor";
    if (role === "tecnico") return "Técnico";
    return "Usuário";
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const me = await getMe();
      setIsAdmin(me.role === "admin");
      if (me.role !== "admin") {
        setUsers([]);
        return;
      }
      const u = await listUsers();
      setUsers(u);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = useMemo(() => users, [users]);

  async function onSave(u: UserAdminRow, next: {
    role: UserRole;
    add_note: boolean;
    add_maintenance: boolean;
    access_glpi_tickets: boolean;
    generate_report: boolean;
    manage_permissions: boolean;
  }) {
    setSavingUser(u.username);
    setError(null);
    try {
      const prevPerms = u.permissions || {};
      const changes: string[] = [];

      if (u.role !== next.role) {
        changes.push(`Papel: ${roleLabel(u.role)} → ${roleLabel(next.role)}`);
      }

      ([
        "add_note",
        "add_maintenance",
        "access_glpi_tickets",
        "generate_report",
        "manage_permissions",
      ] as const).forEach((k) => {
        const before = toBool((prevPerms as any)[k]);
        const after = Boolean((next as any)[k]);
        if (before !== after) {
          changes.push(`${permLabel(k)}: ${before ? "Sim" : "Não"} → ${after ? "Sim" : "Não"}`);
        }
      });

      const updated = await updateUserAccess(u.username, next);
      setUsers((prev) => prev.map((x) => (x.username === updated.username ? updated : x)));

      setChangeTitle(`Alterações salvas para ${updated.username}`);
      setChangeLines(changes.length ? changes : ["Nenhuma alteração detectada."]);
      setChangeOpen(true);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar");
    } finally {
      setSavingUser(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro: {error}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        Apenas administradores podem acessar este painel.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{changeTitle || "Permissões atualizadas"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 text-sm text-gray-700">
            {changeLines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="primary" type="button" onClick={() => setChangeOpen(false)}>
              Ok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6">
        <h2 className="text-xl font-bold text-gray-900">Permissões de Usuários</h2>
        <p className="mt-1 text-sm text-gray-600">
          Marque as permissões. Usuários novos (futuros via LDAP) começam sem permissões.
        </p>
      </div>

      <div className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead style={{ width: 160 }}>Papel</TableHead>
              <TableHead>Adicionar nota</TableHead>
              <TableHead>Adicionar manutenção</TableHead>
              <TableHead>Acessar chamados GLPI</TableHead>
              <TableHead>Gerar relatório</TableHead>
              <TableHead>Gerenciar permissões</TableHead>
              <TableHead style={{ width: 140 }}>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => {
              const perms = u.permissions || {};

              const state = {
                role: u.role,
                add_note: toBool(perms.add_note),
                add_maintenance: toBool(perms.add_maintenance),
                access_glpi_tickets: toBool(perms.access_glpi_tickets),
                generate_report: toBool(perms.generate_report),
                manage_permissions: toBool(perms.manage_permissions),
              };

              return (
                <EditableRow
                  key={u.username}
                  user={u}
                  initial={state}
                  saving={savingUser === u.username}
                  onSave={onSave}
                />
              );
            })}
          </TableBody>
        </Table>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        ) : null}
      </div>
    </div>
  );
}

function EditableRow({
  user,
  initial,
  saving,
  onSave,
}: {
  user: UserAdminRow;
  initial: {
    role: UserRole;
    add_note: boolean;
    add_maintenance: boolean;
    access_glpi_tickets: boolean;
    generate_report: boolean;
    manage_permissions: boolean;
  };
  saving: boolean;
  onSave: (u: UserAdminRow, next: {
    role: UserRole;
    add_note: boolean;
    add_maintenance: boolean;
    access_glpi_tickets: boolean;
    generate_report: boolean;
    manage_permissions: boolean;
  }) => Promise<void>;
}) {
  const [role, setRole] = useState<UserRole>(initial.role);
  const [addNote, setAddNote] = useState(initial.add_note);
  const [addMaint, setAddMaint] = useState(initial.add_maintenance);
  const [accessGlpi, setAccessGlpi] = useState(initial.access_glpi_tickets);
  const [genReport, setGenReport] = useState(initial.generate_report);
  const [managePerms, setManagePerms] = useState(initial.manage_permissions);

  function applyRoleDefaults(nextRole: UserRole) {
    if (nextRole === "admin") {
      setAddNote(true);
      setAddMaint(true);
      setAccessGlpi(true);
      setGenReport(true);
      setManagePerms(true);
      return;
    }
    if (nextRole === "auditor") {
      setAddNote(false);
      setAddMaint(false);
      setAccessGlpi(false);
      setGenReport(true);
      setManagePerms(false);
      return;
    }
    if (nextRole === "tecnico") {
      setAddNote(true);
      setAddMaint(true);
      setAccessGlpi(true);
      setGenReport(false);
      setManagePerms(false);
      return;
    }
    // user
    setAddNote(false);
    setAddMaint(false);
    setAccessGlpi(false);
    setGenReport(false);
    setManagePerms(false);
  }

  const dirty =
    role !== initial.role ||
    addNote !== initial.add_note ||
    addMaint !== initial.add_maintenance ||
    accessGlpi !== initial.access_glpi_tickets ||
    genReport !== initial.generate_report ||
    managePerms !== initial.manage_permissions;

  return (
    <TableRow>
      <TableCell className="font-semibold">{user.username}</TableCell>
      <TableCell>
        <Select
          value={role}
          onValueChange={(v) => {
            const nextRole = v as UserRole;
            setRole(nextRole);
            applyRoleDefaults(nextRole);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Papel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="tecnico">Técnico</SelectItem>
            <SelectItem value="auditor">Auditor</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        <input
          type="checkbox"
          checked={addNote}
          onChange={(e) => setAddNote(e.target.checked)}
          className="h-4 w-4 rounded border border-input align-middle"
        />
      </TableCell>
      <TableCell>
        <input
          type="checkbox"
          checked={addMaint}
          onChange={(e) => setAddMaint(e.target.checked)}
          className="h-4 w-4 rounded border border-input align-middle"
        />
      </TableCell>

      <TableCell>
        <input
          type="checkbox"
          checked={accessGlpi}
          onChange={(e) => setAccessGlpi(e.target.checked)}
          className="h-4 w-4 rounded border border-input align-middle"
        />
      </TableCell>
      <TableCell>
        <input
          type="checkbox"
          checked={genReport}
          onChange={(e) => setGenReport(e.target.checked)}
          className="h-4 w-4 rounded border border-input align-middle"
        />
      </TableCell>
      <TableCell>
        <input
          type="checkbox"
          checked={managePerms}
          onChange={(e) => setManagePerms(e.target.checked)}
          className="h-4 w-4 rounded border border-input align-middle"
        />
      </TableCell>

      <TableCell>
        <Button
          variant="primary"
          type="button"
          disabled={saving || !dirty}
          onClick={() =>
            onSave(user, {
              role,
              add_note: addNote,
              add_maintenance: addMaint,
              access_glpi_tickets: accessGlpi,
              generate_report: genReport,
              manage_permissions: managePerms,
            })
          }
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
