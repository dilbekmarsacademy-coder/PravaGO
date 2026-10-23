"use client";

import { useState } from "react";
import { CheckIcon, EyeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/shared/Card";
import { QuestionImage } from "@/components/test/QuestionImage";
import type { KeywordCard as KeywordCardData } from "@/lib/api/keywords";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { KeywordChip } from "./KeywordChip";
import { KeywordText } from "./KeywordText";

interface KeywordCardProps {
  item: KeywordCardData;
  /** Mavzu ichidagi o'rni (1 dan). */
  position: number;
  /** "Javoblarni berkitish" rejimi — javob xira, bosganda ochiladi. */
  hideAnswers: boolean;
  onToggleReviewed: () => void;
}

export function KeywordCard({ item, position, hideAnswers, onToggleReviewed }: KeywordCardProps) {
  const { locale, t } = useLocale();
  const labels = t.keywords.page;
  const [revealed, setRevealed] = useState(false);
  const hidden = hideAnswers && !revealed;
  const text = localize(item.text, locale);
  const headingId = `kw-${item.id}`;

  return (
    <Card className={cn("flex flex-col gap-4 p-4 transition-colors sm:p-6", item.reviewed && "border-success/30")}>
      <article aria-labelledby={headingId} className="contents">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase tabular-nums">
            {labels.questionNo(position)}
          </span>
          <button
            type="button"
            onClick={onToggleReviewed}
            aria-pressed={item.reviewed}
            aria-label={labels.markReviewed(position)}
            className={cn(
              "-my-1 inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
              item.reviewed
                ? "border-success/50 bg-success/15 text-success"
                : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border transition-colors",
                item.reviewed ? "border-success bg-success text-background" : "border-border-strong",
              )}
              aria-hidden="true"
            >
              {item.reviewed && <CheckIcon className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="hidden sm:inline">{labels.reviewed}</span>
          </button>
        </div>

        <h2 id={headingId} className="text-lg leading-snug font-semibold text-balance text-foreground">
          {text ? (
            <KeywordText text={item.text} highlight={item.keywords?.question?.highlight} tone="question" />
          ) : (
            <span className="sr-only">{labels.questionNo(position)}</span>
          )}
        </h2>

        {item.imageUrl && (
          <QuestionImage
            src={item.imageUrl}
            alt={text || t.testSession.imageAlt}
            width={item.imageWidth}
            height={item.imageHeight}
            variant="card"
          />
        )}

        {item.correctAnswer && (
          <div className="relative">
            <div
              aria-hidden={hidden}
              className={cn(
                "rounded-2xl border-2 border-success bg-success/10 px-4 py-3 transition-[filter,opacity] duration-200",
                hidden && "pointer-events-none opacity-60 blur-sm select-none",
              )}
            >
              <p className="font-mono text-[0.65rem] font-bold tracking-[0.14em] text-success uppercase">{labels.correctAnswer}</p>
              <p className="mt-1 text-base leading-snug font-medium break-words text-foreground">
                <KeywordText text={item.correctAnswer} highlight={item.keywords?.answer?.highlight} tone="answer" />
              </p>
            </div>
            {hidden && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <EyeIcon className="size-4.5" aria-hidden="true" />
                {labels.tapToReveal}
              </button>
            )}
          </div>
        )}

        <div className={cn("transition-[filter,opacity] duration-200", hidden && "opacity-60 blur-sm select-none")} aria-hidden={hidden}>
          <KeywordChip keywords={item.keywords} />
        </div>

        {item.explanation && !hidden && (
          <p className="rounded-r-xl border-l-4 border-brand bg-brand/5 px-4 py-3 text-sm leading-relaxed text-foreground/90">
            <span className="font-semibold text-brand">{labels.explanation}: </span>
            {localize(item.explanation, locale)}
          </p>
        )}
      </article>
    </Card>
  );
}
