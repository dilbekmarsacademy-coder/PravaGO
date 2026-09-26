"use client";

import Link from "next/link";
import { ShuffleIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";
import { Card } from "@/components/shared/Card";

const SIZES = [20, 50, 100, 200];

export default function RandomTestBlock() {
  const { t } = useLocale();
  const labels = t.kabinet.randomTest;

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-foreground/5 text-info">
          <ShuffleIcon className="size-4" />
        </span>
        <h2 className="font-display text-base font-bold text-foreground">{labels.title}</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SIZES.map((size) => (
          <Link
            key={size}
            href={`/kabinet/random?size=${size}`}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-foreground/[0.02] py-3.5 transition-colors hover:border-info/40 hover:bg-foreground/[0.05]"
          >
            <span className="font-mono text-lg font-bold text-foreground tabular-nums">{size}</span>
            <span className="text-[0.65rem] text-muted-foreground uppercase">{labels.questionsUnit}</span>
          </Link>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {labels.note}
      </p>
    </Card>
  );
}
