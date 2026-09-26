"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatClock, type TimeUrgency } from "@/lib/test/timer";

interface TimerRingProps {
  remainingSec: number;
  limitSec: number;
  urgency: TimeUrgency;
  className?: string;
}

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Qolgan vaqt: kichik SVG halqa + mono raqamlar. */
export function TimerRing({ remainingSec, limitSec, urgency, className }: TimerRingProps) {
  const { t } = useLocale();
  const fraction = limitSec > 0 ? Math.max(0, Math.min(1, remainingSec / limitSec)) : 0;

  return (
    <span
      role="timer"
      aria-label={`${t.testSession.timeLeft}: ${formatClock(remainingSec)}`}
      title={t.testSession.timeLeft}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3 font-mono text-sm font-bold tabular-nums transition-colors",
        urgency === "normal" && "border-border text-foreground",
        urgency === "warning" && "border-warning/60 bg-warning/10 text-warning",
        urgency === "critical" && "animate-pulse border-danger/60 bg-danger/10 text-danger [animation-duration:1.6s]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden="true">
        <circle cx="12" cy="12" r={RADIUS} fill="none" strokeWidth="3" className="stroke-current opacity-20" />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          className={cn(
            "transition-[stroke-dashoffset] duration-300 ease-linear",
            urgency === "normal" ? "stroke-brand" : "stroke-current",
          )}
        />
      </svg>
      {formatClock(remainingSec)}
    </span>
  );
}
