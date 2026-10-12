"use client";

// Mavzu testi "darvozasi": video oxirigacha ko'rilmaguncha test qulflangan.
// Holat faqat serverdan keladi (LessonStatus) — localStorage'ga ishonilmaydi.
// Backend ham test savollarini shu holatga qarab beradi (403), bu faqat UI.

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon, CheckCircle2Icon, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import type { LessonStatus } from "@/lib/api/lessons";
import { Card } from "@/components/shared/Card";
import { buttonClasses } from "@/components/shared/Button";

interface LessonTestGateProps {
  status: LessonStatus | null;
  testHref: string;
  className?: string;
}

export function LessonTestGate({ status, testHref, className }: LessonTestGateProps) {
  const { t } = useLocale();
  const gate = t.lesson.gate;

  if (!status) {
    return (
      <Card className={cn("flex items-center gap-4 p-5", className)} aria-busy="true">
        <div className="skeleton-shimmer size-11 shrink-0 rounded-full" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground" role="status">
            {gate.checking}
          </p>
          <div className="skeleton-shimmer mt-2 h-2 w-full rounded-full" aria-hidden="true" />
        </div>
      </Card>
    );
  }

  if (status.completed) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card
          className={cn(
            "flex flex-col gap-4 border-success/30 p-5 sm:flex-row sm:items-center sm:justify-between",
            className,
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2Icon className="size-5" />
            </span>
            <p className="font-display text-sm font-bold text-foreground sm:text-base" role="status">
              {gate.unlocked}
            </p>
          </div>
          <Link href={testHref} className={buttonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" })}>
            {gate.startTest}
            <ArrowRightIcon className="size-4" />
          </Link>
        </Card>
      </motion.div>
    );
  }

  const percent = status.watchedPercent;
  return (
    <Card className={cn("flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <LockIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-foreground sm:text-base">{gate.lockedTitle}</p>
          <div className="mt-2 flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={gate.progress(percent)}
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
              {gate.progress(percent)}
            </span>
          </div>
        </div>
      </div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
      >
        <LockIcon className="size-4" />
        {gate.startTest}
      </button>
    </Card>
  );
}
