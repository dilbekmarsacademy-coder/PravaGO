"use client";

import { useState } from "react";
import { LightbulbIcon } from "lucide-react";
import { OptionButton, type OptionState } from "./OptionButton";
import type { ApiQuestion, CheckAnswerResult } from "@/lib/api/test";
import { useLocale } from "@/lib/i18n/useLocale";

interface QuestionCardProps {
  question: ApiQuestion;
  selectedOptionId: string | null;
  result: CheckAnswerResult | null;
  checking: boolean;
  onAnswer: (optionId: string) => void;
}

function getOptionState(
  optionId: string,
  selectedOptionId: string | null,
  result: CheckAnswerResult | null,
): OptionState {
  if (!result) return selectedOptionId === optionId ? "pending" : "idle";
  if (optionId === result.correctOptionId) return "correct";
  if (optionId === selectedOptionId) return "incorrect";
  return "dimmed";
}

export function QuestionCard({ question, selectedOptionId, result, checking, onAnswer }: QuestionCardProps) {
  const { t } = useLocale();
  // Noto'g'ri javobdan keyin izoh avtomatik ochiladi; foydalanuvchi uni yopishi mumkin.
  const [hintToggled, setHintToggled] = useState<boolean | null>(null);
  const hintOpen = hintToggled ?? (result !== null && !result.correct);
  const answered = result !== null;

  return (
    <section className="flex flex-col gap-4">
      {/* Ba'zi savollarda matn yo'q (faqat rasm orqali savol beriladi). */}
      {question.text && (
        <div className="rounded-2xl border border-neon-orange/30 bg-gradient-to-r from-neon-orange/15 via-neon-orange/5 to-transparent px-5 py-5 sm:px-8 sm:py-6">
          <p className="text-center font-display text-lg leading-snug font-bold text-foreground sm:text-2xl">
            {question.text}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-border bg-black sm:min-h-72">
          {/* eslint-disable-next-line @next/next/no-img-element -- tabiiy
              o'lchamlar server tomonidan berilmagani uchun next/image'ning
              qat'iy width/height talabidan qochamiz */}
          <img
            src={question.imageUrl}
            alt={question.text || t.testSession.imageAlt}
            className="max-h-[50vh] w-full object-contain lg:max-h-[440px]"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          {question.options.map((option, index) => (
            <OptionButton
              key={option.id}
              option={option}
              label={`F${index + 1}`}
              state={getOptionState(option.id, selectedOptionId, result)}
              disabled={answered || checking}
              onSelect={onAnswer}
            />
          ))}

          {answered && (
            <div className="mt-1 overflow-hidden rounded-xl border border-border bg-foreground/[0.03]">
              <button
                type="button"
                onClick={() => setHintToggled(!hintOpen)}
                aria-expanded={hintOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5"
              >
                <LightbulbIcon className="size-4.5 text-neon-amber" aria-hidden="true" />
                {hintOpen ? t.testSession.hideHint : t.testSession.showHint}
              </button>
              {hintOpen && (
                <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-foreground/90">
                  <span className="font-semibold text-neon-green">{t.testSession.keyword} </span>
                  {result.keyword}
                </p>
              )}
            </div>
          )}

          {!answered && (
            <p className="hidden pt-1 text-xs text-muted-foreground lg:block">
              {t.testSession.keyboardHint(question.options.length)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
