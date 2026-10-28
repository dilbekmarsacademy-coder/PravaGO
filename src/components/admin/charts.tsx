"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Oddiy, bitta seriyali grafiklar (bitta o'q, brand rangi, hover'da qiymat).

export function BarChart({ data, label, height = 160 }: { data: { key: string; label: string; value: number }[]; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex items-end gap-[2px] border-b border-border" style={{ height }} role="img" aria-label={label}>
        {data.map((d, i) => (
          <div
            key={d.key}
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          >
            <div
              className={cn("w-full rounded-t-[4px] bg-brand transition-opacity", hover !== null && hover !== i && "opacity-50")}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow">
                <span className="text-muted-foreground">{d.label}:</span> <b className="tabular-nums">{d.value}</b>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[0.65rem] text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>max {max}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** Gorizontal chiziqlar (voronka, qurilmalar, mavzular). */
export function HBars({ rows, unit = "" }: { rows: { label: string; value: number; hint?: string }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_auto]" title={r.hint}>
          <span className="truncate text-foreground/90">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-foreground/10">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="font-mono text-xs tabular-nums">
            {r.value}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
