"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { clearToken } from "@/lib/auth";
import { getMe } from "@/services/authService";
import type { MeResponse } from "@/models/auth";

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "auditor") return "Auditor";
  if (role === "tecnico") return "Técnico";
  return "Usuário";
}

export function UserNav() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [open, setOpen] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, [pathname]);

  const canManage = Boolean(me?.permissions?.manage_permissions);
  const showAdmin = me?.role === "admin" || canManage;

  const name = useMemo(() => {
    if (!me) return "";
    return (me.display_name || me.username || "").toString();
  }, [me]);

  function onLogout() {
    clearToken();
    window.location.href = "/login";
  }

  if (!me) return null;

  return (
    <div className="flex items-center gap-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 text-white border-white/20 hover:bg-white/15"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
            </svg>
            Conta
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Sessão</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Usuário logado</div>
                  <div className="mt-1 text-base font-semibold text-gray-900">{name}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="neutral">{roleLabel(me.role)}</Badge>
                    <span className="text-xs text-muted-foreground">@{me.username}</span>
                  </div>
                </div>

                {showAdmin ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin" onClick={() => setOpen(false)}>
                      Painel Admin
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">Permissões</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-700">
                <div>Adicionar nota: <span className="font-semibold">{me.permissions?.add_note ? "Sim" : "Não"}</span></div>
                <div>Adicionar manutenção: <span className="font-semibold">{me.permissions?.add_maintenance ? "Sim" : "Não"}</span></div>
                <div>Acessar chamados GLPI: <span className="font-semibold">{me.permissions?.access_glpi_tickets ? "Sim" : "Não"}</span></div>
                <div>Gerar relatório: <span className="font-semibold">{me.permissions?.generate_report ? "Sim" : "Não"}</span></div>
                <div>Gerenciar permissões: <span className="font-semibold">{me.permissions?.manage_permissions ? "Sim" : "Não"}</span></div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button variant="destructive" type="button" onClick={onLogout}>
              Sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
