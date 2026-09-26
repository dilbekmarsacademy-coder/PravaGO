"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BookmarkIcon, ChevronDownIcon, LightbulbIcon, PlayCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiQuestion, CheckAnswerResult } from "@/lib/api/test";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { AnswerOption, type AnswerState } from "./AnswerOption";
import { QuestionImage } from "./QuestionImage";

export type TestMode = "practice" | "exam";

interface QuestionViewProps {
  question: ApiQuestion;
  index: number;
  total: number;
  mode: TestMode;
  selectedOptionId: string | null;
  result: CheckAnswerResult | null;
  checking: boolean;
  bookmarked: boolean;
  videoHref: string | null;
  onToggleBookmark: () => void;
  onAnswer: (optionId: string) => void;
}

function getAnswerState(
  mode: TestMode,
  optionId: string,
  selectedOptionId: string | null,
  result: CheckAnswerResult | null,
): AnswerState {
  // Imtihon rejimida to'g'ri/noto'g'ri ko'rsatilmaydi — faqat tanlangan holat.
  if (mode === "exam" || !result) return selectedOptionId === optionId ? "selected" : "idle";
  if (optionId === result.correctOptionId) return "correct";
  if (optionId === selectedOptionId) return "incorrect";
  return "dimmed";
}

export function QuestionView({
  question,
  index,
  total,
  mode,
  selectedOptionId,
  result,
  checking,
  bookmarked,
  videoHref,
  onToggleBookmark,
  onAnswer,
}: QuestionViewProps) {
  const { locale, t } = useLocale();
  const text = localize(question.text, locale);
  const answered = mode === "exam" ? selectedOptionId !== null : result !== null;
  // Noto'g'ri javobdan keyin izoh avtomatik ochiladi; foydalanuvchi uni yopishi mumkin.
  const [hintToggled, setHintToggled] = useState<boolean | null>(null);
  const hintOpen = hintToggled ?? (result !== null && !result.correct);
  const optionCount = question.options.length;

  return (
    <article
      className={cn(
        "grid gap-4 sm:gap-5",
        text
          ? "[grid-template-areas:'meta'_'text'_'image'_'answers']"
          : "[grid-template-areas:'meta'_'image'_'answers']",
        // Katta ekran va telefon albom holati: rasm chapda, savol va javoblar o'ngda.
        "lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-8 lg:gap-y-4",
        "landscape-phone:grid-cols-2 landscape-phone:grid-rows-[auto_auto_1fr] landscape-phone:gap-x-4 landscape-phone:gap-y-3",
        text
          ? "lg:[grid-template-areas:'image_meta'_'image_text'_'image_answers'] landscape-phone:[grid-template-areas:'image_meta'_'image_text'_'image_answers']"
          : "lg:[grid-template-areas:'image_meta'_'image_answers'_'image_.'] landscape-phone:[grid-template-areas:'image_meta'_'image_answers'_'image_.']",
      )}
    >
      <div className="flex items-center justify-between gap-3 [grid-area:meta]">
        <span className="font-mono text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase tabular-nums">
          {t.testSession.questionOf(index + 1, total)}
        </span>
        <button
          type="button"
          onClick={onToggleBookmark}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? t.testSession.unbookmark : t.testSession.bookmark}
          title={bookmarked ? t.testSession.unbookmark : t.testSession.bookmark}
          className={cn(
            "-my-2 flex size-11 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
            bookmarked ? "text-brand" : "text-muted-foreground hover:bg-surface hover:text-foreground",
          )}
        >
          <BookmarkIcon className="size-5" fill={bookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      {text && (
        <h2 className="text-[clamp(1.125rem,0.98rem+0.62vw,1.5rem)] leading-snug font-semibold text-balance text-foreground [grid-area:text]">
          {text}
        </h2>
      )}

      <div className="self-start [grid-area:image]">
        <QuestionImage
          src={question.imageUrl}
          alt={text || t.testSession.imageAlt}
          width={question.imageWidth}
          height={question.imageHeight}
          className="landscape-phone:max-h-[calc(100dvh-10rem)]"
        />
      </div>

      <div className="flex flex-col gap-2.5 [grid-area:answers]">
        {question.options.map((option, optionIndex) => (
          <AnswerOption
            key={option.id}
            label={`F${optionIndex + 1}`}
            text={localize(option.text, locale)}
            state={getAnswerState(mode, option.id, selectedOptionId, result)}
            disabled={answered || checking}
            onSelect={() => onAnswer(option.id)}
          />
        ))}

        <AnimatePresence initial={false}>
          {mode === "practice" && result && (
            <motion.div
              key="explanation"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-1 overflow-hidden rounded-2xl border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setHintToggled(!hintOpen)}
                  aria-expanded={hintOpen}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                >
                  <LightbulbIcon className="size-4.5 text-warning" aria-hidden="true" />
                  <span className="flex-1">{hintOpen ? t.testSession.hideHint : t.testSession.showHint}</span>
                  <ChevronDownIcon
                    className={cn("size-4 text-muted-foreground transition-transform", hintOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                <AnimatePresence initial={false}>
                  {hintOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-4 py-3 text-sm leading-relaxed text-foreground/90">
                        <p>
                          <span className="font-semibold text-success">{t.testSession.keyword} </span>
                          {localize(result.keyword, locale)}
                        </p>
                        {videoHref && (
                          <Link
                            href={videoHref}
                            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <PlayCircleIcon className="size-4.5" aria-hidden="true" />
                            {t.testSession.videoLesson}
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!answered && (
          <p className="mt-1 hidden flex-wrap items-center gap-1.5 text-xs text-muted-foreground pointer-fine:flex">
            {t.testSession.kbdAnswer}: <kbd className="kbd">F1</kbd>–<kbd className="kbd">F{optionCount}</kbd>
            {t.testSession.kbdOr} <kbd className="kbd">1</kbd>–<kbd className="kbd">{optionCount}</kbd>
            <span aria-hidden="true">·</span>
            <kbd className="kbd">←</kbd>/<kbd className="kbd">→</kbd> {t.testSession.kbdQuestions}
          </p>
        )}
      </div>
    </article>
  );
}
