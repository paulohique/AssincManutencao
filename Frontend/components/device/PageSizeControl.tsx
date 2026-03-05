"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  value: number;
  options?: number[];
};

export function PageSizeControl({ value, options = [10, 20, 50, 100] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (nextRaw: string) => {
    const next = Number(nextRaw);
    if (!Number.isFinite(next) || next <= 0) return;

    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("pageSize", String(next));
    params.set("page", "1");

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Itens por página</span>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
        aria-label="Itens por página"
      >
        {options.map((opt) => (
          <option key={opt} value={String(opt)}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
