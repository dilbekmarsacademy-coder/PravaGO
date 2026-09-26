"use client";

import { motion } from "framer-motion";
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/shared/Button";
import { useLocale } from "@/lib/i18n/useLocale";

export type QuestionStatus = "correct" | "incorrect" | "answered";

interface QuestionNavigatorProps {
  total: number;
  currentIndex: number;
  statusByIndex: Record<number, QuestionStatus>;
  bookmarkedIndexes: Set<number>;
  onJump: (index: number) => void;
  /** "card" — sahifadagi karta (Oldingi/Keyingi bilan); "sheet" — telefon bottom sheet ichida. */
  variant?: "card" | "sheet";
}

export function QuestionNavigator({
  total,
  currentIndex,
  statusByIndex,
  bookmarkedIndexes,
  onJump,
  variant = "card",
}: QuestionNavigatorProps) {
  const { t } = useLocale();
  const answeredCount = Object.keys(statusByIndex).length;
  const percent = total > 0 ? (answeredCount / total) * 100 : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-muted-foreground tabular-nums">
          {t.testSession.solved(answeredCount, total)}
        </span>
        {variant === "card" && (
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
              disabled={currentIndex === 0}
              onClick={() => onJump(currentIndex - 1)}
            >
              <ChevronLeftIcon className="size-4" />
              {t.testSession.prev}
            </button>
            <button
              type="button"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
              disabled={currentIndex >= total - 1}
              onClick={() => onJump(currentIndex + 1)}
            >
              {t.testSession.next}
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div
        className={cn(
          "mt-4 grid gap-2",
          variant === "card"
            ? "grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))]"
            : "grid-cols-5 justify-items-center gap-y-3 min-[390px]:grid-cols-6",
        )}
      >
        {Array.from({ length: total }, (_, i) => {
          const status = statusByIndex[i];
          const isCurrent = i === currentIndex;
          const bookmarked = bookmarkedIndexes.has(i);

          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={t.testSession.questionAria(i + 1, status ?? null, bookmarked)}
              className={cn(
                "relative flex size-11 items-center justify-center rounded-lg border font-mono text-sm font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
                status === undefined
                  ? "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                  : "border-brand/25 bg-brand/10 text-foreground",
                isCurrent && "ring-2 ring-brand ring-offset-2 ring-offset-background",
              )}
            >
              {i + 1}
              {(status === "correct" || status === "incorrect") && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full",
                    status === "correct" ? "bg-success" : "bg-danger",
                  )}
                />
              )}
              {bookmarked && (
                <BookmarkIcon
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 size-3.5 text-brand"
                  fill="currentColor"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
