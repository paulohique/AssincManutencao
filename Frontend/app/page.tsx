import { loadDevices } from "@/controllers/devicesController";
import { loadDashboardMetrics } from "@/controllers/dashboardController";
import { loadMaintenanceReport } from "@/controllers/reportController";
import { type DevicesQuery } from "@/models/device";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardPies } from "@/components/dashboard/DashboardPies";
import { ReportClient } from "@/components/report/ReportClient";
import { GlpiTicketsInboxClient } from "@/components/dashboard/GlpiTicketsInboxClient";
import { GlpiSlaAlertsPopupClient } from "@/components/dashboard/GlpiSlaAlertsPopupClient";
import { AuditClient } from "@/components/audit/AuditClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMeServer } from "@/services/meServerService";
import { DevicesTableClient } from "@/components/device/DevicesTableClient";
import { PageSizeControl } from "@/components/device/PageSizeControl";

type Tab = "dispositivos" | "preventiva" | "corretiva" | "relatorio" | "auditoria";

function normalizeTab(tab?: string): Tab {
  if (tab === "preventiva" || tab === "corretiva" || tab === "dispositivos" || tab === "relatorio" || tab === "auditoria") return tab;
  return "dispositivos";
}

export default async function Page({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const hasBackend = Boolean(process.env.NEXT_PUBLIC_PY_API_URL);

  const me = await getMeServer();
  const canGenerateReport = Boolean(me?.permissions?.generate_report);
  const isAdmin = me?.role === "admin";
  const isAuditor = me?.role === "auditor";
  const isTechnician = me?.role === "tecnico";
  const canAccessGlpiTickets = Boolean(me?.permissions?.access_glpi_tickets) || isAdmin;

  const metrics = await loadDashboardMetrics();
  const totalComputers = metrics?.total_computers ?? 0;
  const preventiveDone = metrics?.preventive_done_computers ?? 0;
  const preventiveNeeded = metrics?.preventive_needed_computers ?? 0;
  const correctiveDone = metrics?.corrective_done_total ?? 0;

  const preventivePct = preventiveNeeded > 0
    ? Math.round((preventiveDone / preventiveNeeded) * 100)
    : 0;

  const tab = normalizeTab(
    typeof searchParams?.tab === "string" ? searchParams?.tab : undefined
  );

  const effectiveTab = tab === "relatorio" && !canGenerateReport
    ? "dispositivos"
    : tab === "auditoria" && !isAdmin
      ? "dispositivos"
      : tab;
  const q = typeof searchParams?.q === "string" ? searchParams.q : "";
  const page = Math.max(
    1,
    Number(typeof searchParams?.page === "string" ? searchParams.page : "1") || 1
  );
  const pageSize = Math.max(
    1,
    Math.min(
      100,
      Number(typeof searchParams?.pageSize === "string" ? searchParams.pageSize : "10") || 10
    )
  );

  const data = (effectiveTab === "relatorio" || effectiveTab === "auditoria")
    ? undefined
    : await loadDevices({ tab: effectiveTab as DevicesQuery["tab"], q, page, pageSize });

  const from = data ? (data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1) : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const mkHref = (next: Partial<DevicesQuery>) => {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? tab);
    const nextQ = next.q ?? q;
    if (nextQ) params.set("q", nextQ);
    params.set("page", String(next.page ?? page));
    params.set("pageSize", String(next.pageSize ?? pageSize));
    return `/?${params.toString()}`;
  };

  const reportFrom = typeof searchParams?.from === "string" ? searchParams.from : "";
  const reportTo = typeof searchParams?.to === "string" ? searchParams.to : "";
  const reportTypeRaw = typeof searchParams?.maintenance_type === "string" ? searchParams.maintenance_type : "Ambas";
  const reportType = (reportTypeRaw === "Preventiva" || reportTypeRaw === "Corretiva" || reportTypeRaw === "Ambas")
    ? reportTypeRaw
    : "Ambas";

  const reportTechnician = typeof searchParams?.technician === "string" ? searchParams.technician : "";
  const reportHasTicketRaw = typeof searchParams?.has_ticket === "string" ? searchParams.has_ticket : "";
  const reportHasTicket = reportHasTicketRaw === "true" ? true : reportHasTicketRaw === "false" ? false : undefined;

  const report = effectiveTab === "relatorio"
    ? await loadMaintenanceReport({
        from: reportFrom,
        to: reportTo,
        maintenance_type: reportType,
        q,
        technician: reportTechnician,
        has_ticket: reportHasTicket,
        page,
        page_size: pageSize,
      })
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Controle de Dispositivos</h2>
          <p className="mt-2 text-sm text-gray-600">
            Gerencie a manutenção preventiva e corretiva de todos os dispositivos
          </p>
        </div>

        {!isAuditor && canAccessGlpiTickets ? (
          <div className="flex items-center gap-2">
            {isTechnician ? (
              <GlpiSlaAlertsPopupClient enabled={hasBackend && canAccessGlpiTickets} category="computador" />
            ) : null}
            <GlpiTicketsInboxClient enabled={hasBackend && canAccessGlpiTickets} categoryLabel="Computador" />
          </div>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6">
            <h3 className="text-lg font-bold text-gray-900">Administração</h3>
            <p className="mt-1 text-sm text-gray-600">
              Modifique permissões e papéis (Usuário/Técnico/Auditor/Administrador).
            </p>
          </div>
          <div className="p-6 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Acesso exclusivo para administradores.
            </div>
            <Button asChild variant="primary">
              <Link href="/admin">Abrir painel</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Preventivas Realizadas"
          value={`${preventiveDone} / ${preventiveNeeded}`}
          subtitle={preventiveNeeded > 0 ? `${preventivePct}% concluído` : "—"}
        />
        <StatCard
          title="Total de Computadores"
          value={String(totalComputers)}
          subtitle={hasBackend ? "Espelho local do GLPI" : "Backend não configurado"}
        />
        <StatCard
          title="Corretivas Realizadas"
          value={String(correctiveDone)}
          subtitle="Registros no banco local"
        />
      </div>

      <DashboardPies metrics={metrics} />

      <div className="rounded-xl bg-white p-1.5 shadow-sm border border-gray-200">
        <Tabs value={effectiveTab}>
          <TabsList className="bg-transparent gap-1">
            <TabsTrigger asChild value="dispositivos">
              <Link href={mkHref({ tab: "dispositivos", page: 1 })}>Dispositivos</Link>
            </TabsTrigger>
            <TabsTrigger asChild value="preventiva">
              <Link href={mkHref({ tab: "preventiva", page: 1 })}>
                Manutenção Preventiva
              </Link>
            </TabsTrigger>
            <TabsTrigger asChild value="corretiva">
              <Link href={mkHref({ tab: "corretiva", page: 1 })}>
                Manutenção Corretiva
              </Link>
            </TabsTrigger>
            {canGenerateReport ? (
              <TabsTrigger asChild value="relatorio">
                <Link href="/?tab=relatorio">Relatório</Link>
              </TabsTrigger>
            ) : null}
            {isAdmin ? (
              <TabsTrigger asChild value="auditoria">
                <Link href={mkHref({ tab: "auditoria", page: 1 })}>Auditoria</Link>
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
      </div>

      {tab === "relatorio" && !canGenerateReport ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
          Você não tem permissão para gerar relatórios.
        </div>
      ) : tab === "auditoria" && !isAdmin ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
          Você não tem permissão para acessar auditoria.
        </div>
      ) : effectiveTab === "relatorio" ? (
        <ReportClient
          rows={report?.items ?? []}
          total={report?.total ?? 0}
          page={report?.page ?? page}
          pageSize={report?.page_size ?? pageSize}
          summary={report?.summary ?? null}
          filters={{
            from: reportFrom,
            to: reportTo,
            maintenance_type: reportType as any,
            q,
            technician: reportTechnician,
            has_ticket: reportHasTicket,
          }}
        />
      ) : effectiveTab === "auditoria" ? (
        <AuditClient />
      ) : (
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6">
          <form className="flex w-full gap-3" action="/" method="get">
            <input type="hidden" name="tab" value={tab} />
            <input type="hidden" name="pageSize" value={String(pageSize)} />
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nome, setor ou serial..."
                className="pl-10"
              />
            </div>
            <Button variant="primary" type="submit" className="px-6">
              Buscar
            </Button>
          </form>
        </div>

        <div className="mt-4">
          <DevicesTableClient items={data?.items ?? []} hasBackend={hasBackend} />

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Mostrando {from} - {to} de {data?.total ?? 0}
            </p>

            <PageSizeControl value={pageSize} />

            <div className="flex items-center gap-2">
              <Button asChild variant="outline" type="button">
                <Link href={mkHref({ page: Math.max(1, page - 1) })}>Anterior</Link>
              </Button>
              <span className="text-sm font-extrabold">{page}</span>
              <span className="text-sm text-muted-foreground">/ {pages}</span>
              <Button asChild variant="outline" type="button">
                <Link href={mkHref({ page: Math.min(pages, page + 1) })}>Próximo</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
