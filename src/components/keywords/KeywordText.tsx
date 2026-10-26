"use client";

import { cn } from "@/lib/utils";
import type { HighlightRanges } from "@/lib/api/test";
import type { LocalizedText } from "@/lib/i18n/localized";
import { localizeHighlighted } from "@/lib/keywords/highlight";
import { useLocale } from "@/lib/i18n/useLocale";

export type KeywordTone = "question" | "answer";

/** Savol kaliti — sariq, javob kaliti — yashil (kabinet ranglari). */
export const KEYWORD_MARK_CLASS: Record<KeywordTone, string> = {
  question: "bg-warning/20 text-foreground ring-1 ring-warning/40",
  answer: "bg-success/15 text-foreground ring-1 ring-success/40",
};

interface KeywordTextProps {
  text: LocalizedText;
  /** Belgilash oralig'i; berilmasa matn oddiy ko'rinadi. */
  highlight?: HighlightRanges;
  tone: KeywordTone;
  className?: string;
}

/** Tanlangan tildagi matn, kalit so'z bo'lagi `<mark>` bilan belgilangan. */
export function KeywordText({ text, highlight, tone, className }: KeywordTextProps) {
  const { locale } = useLocale();
  const { text: value, segments } = localizeHighlighted(text, highlight, locale);
  if (!segments) return <span className={className}>{value}</span>;
  return (
    <span className={className}>
      {segments.map((segment, i) =>
        segment.marked ? (
          <mark key={i} className={cn("rounded-md px-1 py-px font-semibold [box-decoration-break:clone]", KEYWORD_MARK_CLASS[tone])}>
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </span>
  );
}
