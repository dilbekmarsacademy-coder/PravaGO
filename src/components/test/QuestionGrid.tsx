"use client";

import { cn } from "cn";
import { useLocale } from "@/lib/i18n/useLocale";
import type { CheckAnswerResult } from "@/lib/api/test";

interface QuestionGridProps {
  total: number;
  currentIndex: number;
  results: Record<number, CheckAnswerResult>;
  onJump: (index: number) => void;
}

export function QuestionGrid({ total, currentIndex, results, onJump }: QuestionGridProps) {
  const { t } = useLocale();

  return (
    <div className="grid grid-cols-8 gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-10">
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
              "flex size-8 items-center justify-center rounded-md text-xs font-semibold transition-colors",
              result === undefined &&
                "bg-background text-muted-foreground hover:bg-foreground/10",
              result?.correct === true &&
                "bg-[var(--neon-green)] text-white",
              result?.correct === false &&
                "bg-destructive text-white",
              isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
