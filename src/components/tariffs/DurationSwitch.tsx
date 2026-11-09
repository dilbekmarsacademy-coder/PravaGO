"use client";

import { cn } from "@/lib/utils";

/** Muddat almashtirgich (Standart: 1 hafta / 2 hafta / 1 oy) — narx tanlovga qarab o'zgaradi. */
export default function DurationSwitch({
  labels,
  value,
  onChange,
  ariaLabel,
}: {
  labels: string[];
  value: number;
  onChange: (index: number) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-flow-col gap-1 rounded-full border border-border bg-foreground/[0.04] p-1" data-testid="duration-switch">
      {labels.map((label, i) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={i === value}
          onClick={() => onChange(i)}
          className={cn(
            "rounded-full px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors sm:text-sm",
            i === value ? "bg-gradient-to-r from-neon-orange to-neon-orange-2 text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
