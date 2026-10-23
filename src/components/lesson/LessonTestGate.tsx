"use client";

// Video ostidagi blok: doim ko'rinadigan "Ko'rildi: N%" chizig'i va "Test
// ishlash" tugmasi. Video oxirigacha ko'rilmaguncha tugma qulflangan.
// Holat faqat serverdan keladi (LessonStatus) — localStorage'ga ishonilmaydi.
// Backend ham test savollarini shu holatga qarab beradi (403
// LESSON_NOT_COMPLETED) — bu yerdagi qulf faqat UI.

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon, CheckCircle2Icon, ClockIcon, KeyRoundIcon, ListChecksIcon, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import type { LessonStatus } from "@/lib/api/lessons";
import { Card } from "@/components/shared/Card";
import { Modal } from "@/components/shared/Modal";
import { buttonClasses } from "@/components/shared/Button";

interface LessonTestGateProps {
  status: LessonStatus | null;
  /** Darsga hali video ulanmagan — test doim qulflangan. */
  unavailable?: boolean;
  /** Test sahifasi (test banki ulangan bo'lsa); yo'q bo'lsa — "tez orada" modali. */
  testHref?: string | null;
  /** "Kalit so'zlar" bo'limi — test bilan bir vaqtda ochiladi. */
  keywordsHref?: string | null;
  className?: string;
}

export function LessonTestGate({ status, unavailable = false, testHref, keywordsHref, className }: LessonTestGateProps) {
  const { t } = useLocale();
  const gate = t.lesson.gate;
  const [soonOpen, setSoonOpen] = useState(false);

  if (!status && !unavailable) {
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

  // Videosi hali ulanmagan mavzuda test banki bo'lsa — video sharti yo'q (backend ham testni beradi).
  const noVideoGate = unavailable && Boolean(testHref);
  const completed = Boolean(status?.completed) || noVideoGate;
  const percent = status?.watchedPercent ?? 0;
  const buttonClass = buttonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" });

  return (
    <Card
      className={cn(
        "flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between",
        completed && "border-success/30",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            completed ? "bg-success/15 text-success" : "bg-brand/10 text-brand",
          )}
        >
          {completed ? <CheckCircle2Icon className="size-5" /> : <LockIcon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-foreground sm:text-base" role="status" aria-live="polite">
            {completed ? gate.unlocked : gate.lockedTitle}
          </p>
          <div className={cn("mt-2 flex items-center gap-3", noVideoGate && "hidden")}>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={gate.progress(percent)}
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  completed ? "bg-success" : "bg-gradient-to-r from-brand to-brand-2",
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
              {gate.progress(percent)}
            </span>
          </div>
        </div>
      </div>

      {!completed ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={gate.lockedTitle}
          className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
        >
          <LockIcon className="size-4" />
          {gate.startTest}
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
        >
          {keywordsHref && (
            <Link
              href={keywordsHref}
              className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
            >
              <KeyRoundIcon className="size-4" />
              {t.keywords.open}
            </Link>
          )}
          {testHref ? (
            <Link href={testHref} className={buttonClass}>
              {gate.startTest}
              <ArrowRightIcon className="size-4" />
            </Link>
          ) : (
            <button type="button" onClick={() => setSoonOpen(true)} className={buttonClass}>
              <ListChecksIcon className="size-4" />
              {gate.startTest}
            </button>
          )}
        </motion.div>
      )}

      <Modal
        open={soonOpen}
        onOpenChange={setSoonOpen}
        icon={
          <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
            <ClockIcon className="size-5" />
          </span>
        }
        title={gate.soonTitle}
        description={gate.soonDesc}
      >
        <button
          type="button"
          onClick={() => setSoonOpen(false)}
          className={buttonClasses({ variant: "secondary", size: "md", className: "w-full" })}
        >
          {gate.close}
        </button>
      </Modal>
    </Card>
  );
}
