"use client";

import { ArrowRightIcon, KeyRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionKeywords } from "@/lib/api/test";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { KEYWORD_MARK_CLASS } from "./KeywordText";

interface KeywordChipProps {
  /** `null` (yoki ikkala qism bo'sh) — "Kalit so'z mavjud emas". */
  keywords: QuestionKeywords | null | undefined;
  className?: string;
}

/** "SAVOL KALITI → JAVOB KALITI" yoki neytral "Kalit so'z mavjud emas". */
export function KeywordChip({ keywords, className }: KeywordChipProps) {
  const { locale, t } = useLocale();
  const labels = t.keywords;
  const question = keywords?.question ? localize(keywords.question.text, locale) : "";
  const answer = keywords?.answer ? localize(keywords.answer.text, locale) : "";

  if (!question && !answer) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-dashed border-border-strong bg-foreground/[0.03] px-3 py-1.5 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        <KeyRoundIcon className="size-3.5 shrink-0" aria-hidden="true" />
        {labels.none}
      </p>
    );
  }

  return (
    <p
      className={cn("flex flex-wrap items-center gap-1.5 text-xs font-bold tracking-wide uppercase", className)}
    >
      <Part text={question} tone="question" fallback={labels.partNone} title={labels.questionKey} />
      <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Part text={answer} tone="answer" fallback={labels.partNone} title={labels.answerKey} />
    </p>
  );
}

function Part({ text, tone, fallback, title }: { text: string; tone: "question" | "answer"; fallback: string; title: string }) {
  if (!text) {
    return (
      <span title={title} className="rounded-full px-2.5 py-1 font-medium tracking-normal text-muted-foreground normal-case italic">
        <span className="sr-only">{title}: </span>
        {fallback}
      </span>
    );
  }
  return (
    <span title={title} className={cn("rounded-full px-2.5 py-1 break-words", KEYWORD_MARK_CLASS[tone])}>
      <span className="sr-only normal-case">{title}: </span>
      {text}
    </span>
  );
}
