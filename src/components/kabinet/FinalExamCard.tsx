"use client";

import { FlagIcon, LockIcon } from "lucide-react";
import type { ExamStatus } from "@/components/home/types";
import { FINAL_EXAM_FLOW_ENABLED } from "@/config/rules";
import { useLocale } from "@/lib/i18n/useLocale";
import { cn } from "@/lib/utils";
import { Card } from "@/components/shared/Card";
import { Badge } from "@/components/shared/Badge";

interface FinalExamCardProps {
  examStatus: ExamStatus;
  attemptsUsed: number;
  maxAttempts: number;
  unlocked: boolean;
  /** Savollar bazasi — 1–6-kunlardagi barcha mavzular savollari yig'indisi. */
  poolSize: number;
}

export default function FinalExamCard({
  examStatus,
  attemptsUsed,
  maxAttempts,
  unlocked,
  poolSize,
}: FinalExamCardProps) {
  const { t } = useLocale();
  const labels = t.kabinet.finalExam;

  // Har bir urinishda bazadan tasodifiy tanlanadigan savollar soni va vaqt.
  const format =
    examStatus === "first-time"
      ? { questions: 20, minutes: 25 }
      : { questions: 50, minutes: 45 };

  // TZ: yakuniy imtihon oqimi hali qurilmagani sababli kartochka hozircha
  // doim qulflangan holatda ko'rsatiladi (FINAL_EXAM_FLOW_ENABLED — config/rules.ts).
  const isAvailable = FINAL_EXAM_FLOW_ENABLED && unlocked;

  return (
    <Card
      className="relative overflow-hidden border-brand/40 bg-gradient-to-br from-brand/10 via-transparent to-info/5 px-5 py-5 shadow-[0_0_32px_-12px_var(--brand)]"
      aria-disabled={!isAvailable}
    >
      <div
        className="pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full bg-brand/20 blur-[80px]"
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              isAvailable
                ? "glow-orange bg-gradient-to-br from-brand to-brand-2 text-background"
                : "bg-brand/15 text-brand",
            )}
          >
            {isAvailable ? <FlagIcon className="size-5" /> : <LockIcon className="size-5" />}
          </span>
          <div className="min-w-0">
            <span className="font-mono text-[0.65rem] font-bold tracking-[0.2em] text-brand uppercase">
              {labels.badge}
            </span>
            <p className="font-display text-base font-bold text-foreground sm:text-lg">{labels.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {labels.pool(poolSize)} &middot; {labels.format(format.questions, format.minutes)}
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
              {labels.attempts(attemptsUsed, maxAttempts)}
            </p>
            {!unlocked && (
              <p className="mt-2 text-xs text-foreground/70">{labels.lockedHint}</p>
            )}
          </div>
        </div>

        <Badge tone={isAvailable ? "success" : "muted"}>{isAvailable ? labels.open : labels.locked}</Badge>
      </div>
    </Card>
  );
}
