"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
} from "recharts";

type Slice = {
  name: string;
  value: number;
  color: string;
};

function formatNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(n);
}

export function PiePanel({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: Slice[];
}) {
  const filtered = useMemo(() => data.filter((d) => (d.value ?? 0) > 0), [data]);
  const safeData = filtered.length > 0 ? filtered : [{ name: "Sem dados", value: 1, color: "#E5E7EB" }];

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const next = {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      };
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => measure());
      ro.observe(el);
      return () => ro.disconnect();
    }

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        {subtitle ? <div className="text-xs text-gray-500">{subtitle}</div> : null}
      </div>

      <div ref={containerRef} className="h-56 w-full min-w-0">
        {size.width > 0 && size.height > 0 ? (
          <PieChart width={size.width} height={size.height}>
            <Tooltip formatter={(value: any, name: any) => [formatNumber(value), String(name)]} />
            <Legend verticalAlign="bottom" height={24} />
            <Pie
              data={safeData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              isAnimationActive
            >
              {safeData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
            </Pie>
          </PieChart>
        ) : null}
      </div>
    </div>
  );
}
