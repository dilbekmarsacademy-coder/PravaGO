"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import type { CheckAnswerResult } from "@/lib/api/test";
import { useLocale } from "@/lib/i18n/useLocale";

interface QuestionGridProps {
  total: number;
  currentIndex: number;
  results: Record<number, CheckAnswerResult>;
  onJump: (index: number) => void;
}

export function QuestionGrid({ total, currentIndex, results, onJump }: QuestionGridProps) {
  const { t } = useLocale();
  const answeredCount = Object.keys(results).length;

  const navButton =
    "flex h-9 items-center gap-1 rounded-full border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-neon-orange/50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {t.testSession.solved(answeredCount, total)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={navButton}
            disabled={currentIndex === 0}
            onClick={() => onJump(currentIndex - 1)}
          >
            <ChevronLeftIcon className="size-4" />
            {t.testSession.prev}
          </button>
          <button
            type="button"
            className={navButton}
            disabled={currentIndex >= total - 1}
            onClick={() => onJump(currentIndex + 1)}
          >
            {t.testSession.next}
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: total }, (_, i) => {
          const result = results[i];
          const isCurrent = i === currentIndex;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              aria-current={isCurrent}
              aria-label={t.testSession.questionAria(
                i + 1,
                result ? (result.correct ? "correct" : "incorrect") : null,
              )}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors",
                result === undefined && "bg-foreground/5 text-muted-foreground hover:bg-foreground/10",
                result?.correct === true && "bg-neon-green text-background",
                result?.correct === false && "bg-neon-red text-white",
                isCurrent && "ring-2 ring-neon-orange ring-offset-2 ring-offset-background",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
