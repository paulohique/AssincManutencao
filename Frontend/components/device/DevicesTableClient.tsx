"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DeviceRow, MaintenanceStatus } from "@/models/device";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SortKey = "none" | "name" | "status" | "last_maintenance" | "next_maintenance";
type SortDir = "asc" | "desc";

function statusVariant(status: string) {
  if (status === "Em Dia") return "ok";
  if (status === "Atrasada") return "late";
  if (status === "Pendente") return "pending";
  return "neutral";
}

function statusRank(status: MaintenanceStatus) {
  if (status === "Pendente") return 0;
  if (status === "Atrasada") return 1;
  return 2; // Em Dia
}

function parseDate(value: string | null) {
  if (!value) return Number.NaN;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : Number.NaN;
}

export function DevicesTableClient({
  items,
  hasBackend
}: {
  items: DeviceRow[];
  hasBackend: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("none");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // Direção padrão por coluna (mantém a lógica original)
    if (key === "last_maintenance" || key === "next_maintenance") {
      setSortDir("desc");
    } else {
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const base = items.slice();
    if (sortKey === "none") return base;

    const withIndex = base.map((x, idx) => ({ x, idx }));

    const dirMul = sortDir === "asc" ? 1 : -1;

    withIndex.sort((a, b) => {
      const A = a.x;
      const B = b.x;

      if (sortKey === "name") {
        const cmp = String(A.device_name || "").localeCompare(String(B.device_name || ""), "pt-BR", {
          sensitivity: "base"
        });
        if (cmp !== 0) return cmp * dirMul;
      }

      if (sortKey === "status") {
        const cmp = statusRank(A.maintenance_status) - statusRank(B.maintenance_status);
        if (cmp !== 0) return cmp * dirMul;
        const nameCmp = String(A.device_name || "").localeCompare(String(B.device_name || ""), "pt-BR", {
          sensitivity: "base"
        });
        if (nameCmp !== 0) return nameCmp * dirMul;
      }

      if (sortKey === "last_maintenance") {
        const ta = parseDate(A.last_maintenance_date);
        const tb = parseDate(B.last_maintenance_date);
        const aNaN = Number.isNaN(ta);
        const bNaN = Number.isNaN(tb);
        if (aNaN !== bNaN) return aNaN ? 1 : -1; // nulls por último
        if (!aNaN && !bNaN && ta !== tb) return (tb - ta) * dirMul;
      }

      if (sortKey === "next_maintenance") {
        const ta = parseDate(A.next_maintenance_date);
        const tb = parseDate(B.next_maintenance_date);
        const aNaN = Number.isNaN(ta);
        const bNaN = Number.isNaN(tb);
        if (aNaN !== bNaN) return aNaN ? 1 : -1;
        if (!aNaN && !bNaN && ta !== tb) return (tb - ta) * dirMul;
      }

      return a.idx - b.idx; // estável
    });

    return withIndex.map((w) => w.x);
  }, [items, sortKey, sortDir]);

  const headerBtnClass = "text-left font-semibold";

  const sortMark = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const ariaSort = (key: SortKey): React.AriaAttributes["aria-sort"] => {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ width: "25%" }}>
            <button
              type="button"
              className={headerBtnClass}
              onClick={() => onSort("name")}
              aria-label="Ordenar por nome"
              aria-sort={ariaSort("name")}
              title="Ordenar por nome"
            >
              Nome{sortMark("name")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className={headerBtnClass}
              onClick={() => onSort("status")}
              aria-label="Ordenar por status"
              aria-sort={ariaSort("status")}
              title="Ordenar por status"
            >
              Status{sortMark("status")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className={headerBtnClass}
              onClick={() => onSort("last_maintenance")}
              aria-label="Ordenar por última manutenção"
              aria-sort={ariaSort("last_maintenance")}
              title="Ordenar por última manutenção"
            >
              Última Manutenção{sortMark("last_maintenance")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className={headerBtnClass}
              onClick={() => onSort("next_maintenance")}
              aria-label="Ordenar por próxima manutenção"
              aria-sort={ariaSort("next_maintenance")}
              title="Ordenar por próxima manutenção"
            >
              Próxima Manutenção{sortMark("next_maintenance")}
            </button>
          </TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {sorted.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-semibold">
              <Link href={`/dispositivos/${row.id}`} className="hover:underline" title="Abrir detalhes">
                {row.device_name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant(row.maintenance_status) as any}>{row.maintenance_status}</Badge>
            </TableCell>
            <TableCell>{row.last_maintenance_date ?? "—"}</TableCell>
            <TableCell>{row.next_maintenance_date ?? "A Agendar"}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button asChild variant="outline" type="button">
                  <Link href={`/dispositivos/${row.id}`}>Visualizar</Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}

        {sorted.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-12 text-gray-500">
              <div className="flex flex-col items-center gap-2">
                <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-medium">Nenhum dispositivo encontrado</p>
                {!hasBackend ? (
                  <p className="text-xs text-gray-400">
                    Configure a variável NEXT_PUBLIC_PY_API_URL para conectar ao backend
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">Rode o sync do GLPI no backend para importar dados</p>
                )}
              </div>
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
