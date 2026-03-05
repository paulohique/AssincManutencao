"use client";

import { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageSizeControl } from "@/components/device/PageSizeControl";
import { StatCard } from "@/components/dashboard/StatCard";
import { type MaintenanceReportRow, type MaintenanceReportSummary, type MaintenanceTypeFilter } from "@/models/report";

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function ReportClient({
  rows,
  total,
  page,
  pageSize,
  summary,
  filters,
}: {
  rows: MaintenanceReportRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: MaintenanceReportSummary | null;
  filters: {
    from: string;
    to: string;
    maintenance_type: MaintenanceTypeFilter;
    q?: string;
    technician?: string;
    has_ticket?: boolean;
  };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (filters.maintenance_type) parts.push(`Tipo: ${filters.maintenance_type}`);
    if (filters.from) parts.push(`De: ${filters.from}`);
    if (filters.to) parts.push(`Até: ${filters.to}`);
    if (filters.q) parts.push(`Busca: ${filters.q}`);
    if (filters.technician) parts.push(`Técnico: ${filters.technician}`);
    if (typeof filters.has_ticket === "boolean") {
      parts.push(filters.has_ticket ? "Com ticket" : "Sem ticket");
    }
    return parts.join(" | ");
  }, [filters]);

  const mkHref = (next: { page?: number }) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", "relatorio");
    params.set("page", String(next.page ?? page));
    params.set("pageSize", String(pageSize));
    return `${pathname}?${params.toString()}`;
  };

  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
  const fromRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(total, page * pageSize);

  const onDownloadCsv = () => {
    const headers = [
      "computador",
      "patrimonio",
      "local",
      "serial",
      "tecnico",
      "tipo",
      "ticket_glpi",
      "data",
      "descricao",
    ];

    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replaceAll("\"", "\"\"")}"`;
    };

    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.computer_name,
          r.patrimonio ?? "",
          r.location ?? "",
          r.serial ?? "",
          r.technician ?? "",
          r.maintenance_type,
          r.glpi_ticket_id ?? "",
          r.performed_at,
          r.description ?? "",
        ]
          .map(esc)
          .join(",")
      ),
    ];

    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-manutencoes-${filters.maintenance_type || "todas"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onDownloadPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Relatório de Manutenções", 40, 40);
    doc.setFontSize(10);
    if (subtitle) doc.text(subtitle, 40, 58);

    const body = rows.map((r) => [
      r.computer_name,
      r.patrimonio ?? "—",
      r.technician ?? "—",
      r.maintenance_type,
      r.glpi_ticket_id != null ? String(r.glpi_ticket_id) : "—",
      fmtDate(r.performed_at),
    ]);

    autoTable(doc, {
      startY: 75,
      head: [["Computador", "Patrimônio", "Técnico", "Tipo", "Ticket", "Data"]],
      body,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [17, 24, 39] },
      theme: "grid",
    });

    const fileName = `relatorio-manutencoes-${filters.maintenance_type || "todas"}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6">
        <h3 className="text-lg font-bold text-gray-900">Relatório</h3>
        <p className="mt-1 text-sm text-gray-600">
          Filtre por tipo, período e outros campos. Exporta em PDF/CSV.
        </p>

        {summary ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Registros" value={String(summary.total_records)} subtitle="Total no filtro" />
            <StatCard title="Computadores" value={String(summary.total_computers)} subtitle="Únicos" />
            <StatCard title="Técnicos" value={String(summary.total_technicians)} subtitle="Únicos" />
            <StatCard
              title="Preventivas"
              value={String(summary.totals_by_type?.Preventiva ?? 0)}
              subtitle="No período"
            />
            <StatCard
              title="Corretivas"
              value={String(summary.totals_by_type?.Corretiva ?? 0)}
              subtitle="No período"
            />
          </div>
        ) : null}

        <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-6" action="/" method="get">
          <input type="hidden" name="tab" value="relatorio" />
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />

          <div>
            <label className="text-xs text-gray-600">Tipo</label>
            <select
              name="maintenance_type"
              defaultValue={filters.maintenance_type}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="Ambas">Ambas</option>
              <option value="Preventiva">Preventiva</option>
              <option value="Corretiva">Corretiva</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">Busca</label>
            <Input
              className="mt-1"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Computador, patrimônio, serial, local, descrição..."
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Técnico</label>
            <Input className="mt-1" name="technician" defaultValue={filters.technician ?? ""} placeholder="Nome" />
          </div>

          <div>
            <label className="text-xs text-gray-600">De</label>
            <Input className="mt-1" type="date" name="from" defaultValue={filters.from} />
          </div>

          <div>
            <label className="text-xs text-gray-600">Até</label>
            <Input className="mt-1" type="date" name="to" defaultValue={filters.to} />
          </div>

          <div className="flex items-end gap-2">
            <div className="w-full">
              <label className="text-xs text-gray-600">Ticket GLPI</label>
              <select
                name="has_ticket"
                defaultValue={typeof filters.has_ticket === "boolean" ? (filters.has_ticket ? "true" : "false") : ""}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                <option value="true">Somente com ticket</option>
                <option value="false">Somente sem ticket</option>
              </select>
            </div>
          </div>

          <div className="flex items-end gap-2 sm:col-span-2">
            <Button variant="primary" type="submit" className="w-full">Gerar</Button>
            <Button variant="outline" type="button" onClick={onDownloadPdf} disabled={rows.length === 0}>
              Salvar PDF
            </Button>
            <Button variant="outline" type="button" onClick={onDownloadCsv} disabled={rows.length === 0}>
              Salvar CSV
            </Button>
          </div>
        </form>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Mostrando {fromRow} - {toRow} de {total}
          </p>

          <div className="flex items-center gap-3">
            <PageSizeControl value={pageSize} />
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" type="button" disabled={page <= 1}>
                <Link href={mkHref({ page: Math.max(1, page - 1) })}>Anterior</Link>
              </Button>
              <span className="text-sm font-extrabold">{page}</span>
              <span className="text-sm text-muted-foreground">/ {totalPages}</span>
              <Button asChild variant="outline" type="button" disabled={page >= totalPages}>
                <Link href={mkHref({ page: Math.min(totalPages, page + 1) })}>Próximo</Link>
              </Button>
            </div>
          </div>
        </div>

        {summary?.top_technicians?.length ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">Top técnicos (no filtro)</p>
            </div>
            <div className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.top_technicians.map((t) => (
                    <TableRow key={t.technician}>
                      <TableCell className="font-semibold">{t.technician}</TableCell>
                      <TableCell className="text-right">{t.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Computador</TableHead>
                <TableHead>Patrimônio</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={`${r.computer_id}-${r.performed_at}-${idx}`}>
                  <TableCell className="font-semibold">{r.computer_name}</TableCell>
                  <TableCell>{r.patrimonio ?? "—"}</TableCell>
                  <TableCell>{r.location ?? "—"}</TableCell>
                  <TableCell>{r.technician ?? "—"}</TableCell>
                  <TableCell>{r.maintenance_type}</TableCell>
                  <TableCell>{r.glpi_ticket_id != null ? String(r.glpi_ticket_id) : "—"}</TableCell>
                  <TableCell>{fmtDate(r.performed_at)}</TableCell>
                  <TableCell className="max-w-[340px] truncate" title={r.description ?? ""}>
                    {r.description ?? "—"}
                  </TableCell>
                </TableRow>
              ))}

              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                    Nenhum registro encontrado para esse filtro.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
