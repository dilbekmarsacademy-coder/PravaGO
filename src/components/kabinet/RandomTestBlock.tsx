"use client";

import Link from "next/link";
import { ShuffleIcon, TimerIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";
import { RANDOM_TEST_SIZES } from "@/lib/api/random-tests";
import { Card } from "@/components/shared/Card";

export default function RandomTestBlock() {
  const { t } = useLocale();
  const labels = t.kabinet.randomTest;

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-foreground/5 text-info">
          <ShuffleIcon className="size-4" />
        </span>
        <h2 className="font-display text-base font-bold text-foreground">
          <Link href="/kabinet/random" className="hover:text-brand">
            {labels.title}
          </Link>
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RANDOM_TEST_SIZES.map((size) => (
          <Link
            key={size}
            href={`/kabinet/random?size=${size}`}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-foreground/[0.02] py-3.5 transition-colors hover:border-info/40 hover:bg-foreground/[0.05]"
          >
            <span className="font-mono text-lg font-bold text-foreground tabular-nums">{size}</span>
            <span className="text-[0.65rem] text-muted-foreground uppercase">{labels.questionsUnit}</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
              <TimerIcon className="size-3" />
              {labels.minutes(size)}
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {labels.note}
      </p>
    </Card>
  );
}
