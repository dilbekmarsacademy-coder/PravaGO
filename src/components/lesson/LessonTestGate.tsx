"use client";

// Video ostidagi blok: doim ko'rinadigan "Ko'rildi: N%" chizig'i va "Test
// ishlash" tugmasi. Video oxirigacha ko'rilmaguncha tugma qulflangan; video
// ko'rilgach — avval barcha savollar va kalit so'zlar bilan tanishiladi
// ("Tanishildi: N / M"), test shundan keyin ochiladi.
// Holat faqat serverdan keladi (LessonStatus) — localStorage'ga ishonilmaydi.
// Backend ham test savollarini shu holatga qarab beradi (403
// LESSON_NOT_COMPLETED / KEYWORDS_NOT_REVIEWED) — bu yerdagi qulf faqat UI.

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon, CheckCircle2Icon, ClockIcon, KeyRoundIcon, ListChecksIcon, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import type { LessonStatus } from "@/lib/api/lessons";
import type { KeywordProgress } from "@/lib/api/keywords";
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
  /** Savollar bilan tanishish holati (serverdan); null — noma'lum, test tugmasi ochiq qoladi. */
  keywordProgress?: KeywordProgress | null;
  /** Admin hamma narsani ochib qo'ygan: test videosiz va kalit so'zlarsiz ochiq. */
  unlockAll?: boolean;
  className?: string;
}

export function LessonTestGate({
  status,
  unavailable = false,
  testHref,
  keywordsHref,
  keywordProgress = null,
  unlockAll = false,
  className,
}: LessonTestGateProps) {
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
  const completed = Boolean(status?.completed) || noVideoGate || (unlockAll && Boolean(testHref));
  // Video ko'rilgan, lekin hali hamma savol bilan tanishilmagan — test yopiq.
  const studying =
    !unlockAll &&
    completed && Boolean(testHref && keywordsHref) && keywordProgress !== null && keywordProgress.reviewedCount < keywordProgress.total;
  const studied = completed && Boolean(testHref) && keywordProgress !== null && !studying;
  const percent = studying
    ? Math.round((keywordProgress!.reviewedCount / keywordProgress!.total) * 100)
    : (status?.watchedPercent ?? 0);
  const progressLabel = studying ? gate.keywordsProgress(keywordProgress!.reviewedCount, keywordProgress!.total) : gate.progress(percent);
  const buttonClass = buttonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" });

  return (
    <Card
      className={cn(
        "flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between",
        completed && !studying && "border-success/30",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            completed && !studying ? "bg-success/15 text-success" : "bg-brand/10 text-brand",
          )}
        >
          {studying ? (
            <KeyRoundIcon className="size-5" />
          ) : completed ? (
            <CheckCircle2Icon className="size-5" />
          ) : (
            <LockIcon className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-foreground sm:text-base" role="status" aria-live="polite">
            {studying ? gate.keywordsTitle : studied ? gate.testUnlocked : completed ? gate.unlocked : gate.lockedTitle}
          </p>
          <div className={cn("mt-2 flex items-center gap-3", noVideoGate && "hidden")}>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={progressLabel}
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  completed && !studying ? "bg-success" : "bg-gradient-to-r from-brand to-brand-2",
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
              {progressLabel}
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
      ) : studying ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
        >
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={gate.testLockedHint}
            className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
          >
            <LockIcon className="size-4" />
            {gate.startTest}
          </button>
          <Link href={keywordsHref!} className={buttonClass} data-testid="gate-keywords">
            <KeyRoundIcon className="size-4" />
            {gate.keywordsButton}
            <ArrowRightIcon className="size-4" />
          </Link>
        </motion.div>
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
