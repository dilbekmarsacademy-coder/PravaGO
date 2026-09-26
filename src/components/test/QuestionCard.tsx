"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptionButton, type OptionState } from "./OptionButton";
import type { ApiQuestion, CheckAnswerResult } from "@/lib/api/test";
import { useLocale } from "@/lib/i18n/useLocale";

interface QuestionCardProps {
  question: ApiQuestion;
  selectedOptionId: string | null;
  result: CheckAnswerResult | null;
  checking: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onSelect: (optionId: string) => void;
  onCheckAnswer: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function getOptionState(
  optionId: string,
  selectedOptionId: string | null,
  result: CheckAnswerResult | null,
): OptionState {
  if (!result) {
    return selectedOptionId === optionId ? "selected" : "idle";
  }
  if (optionId === result.correctOptionId) return "correct";
  if (optionId === selectedOptionId) return "incorrect";
  return "idle";
}

export function QuestionCard({
  question,
  selectedOptionId,
  result,
  checking,
  canGoPrev,
  canGoNext,
  onSelect,
  onCheckAnswer,
  onPrev,
  onNext,
}: QuestionCardProps) {
  const { t } = useLocale();
  const answered = result !== null;

  return (
    <Card>
      {/* Ba'zi savollarda matn yo'q (faqat rasm orqali savol beriladi) —
          bunday holatda bo'sh sarlavha joyini chiqarmaymiz. */}
      {question.text && (
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{question.text}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-4 px-4">
        {/* Savol rasmlari turli nisbatlarda (panorama'dan deyarli kvadratgacha)
            keladi — object-contain + cheklangan balandlik barcha rasmlarni
            cho'zmasdan, ekran o'lchamiga moslab (responsive) ko'rsatadi. */}
        <div className="flex w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- tabiiy
              o'lchamlar server tomonidan berilmagani uchun next/image'ning
              qat'iy width/height talabidan qochamiz */}
          <img
            src={question.imageUrl}
            alt={question.text || t.testSession.imageAlt}
            className="max-h-[60vh] w-full object-contain sm:max-h-[420px]"
          />
        </div>

        <div className="flex flex-col gap-2">
          {question.options.map((option) => (
            <OptionButton
              key={option.id}
              option={option}
              state={getOptionState(option.id, selectedOptionId, result)}
              disabled={answered}
              onSelect={onSelect}
            />
          ))}
        </div>

        {result && !result.correct && (
          <div className="rounded-lg border border-[var(--neon-green)] bg-[var(--neon-green)]/10 px-4 py-3 text-sm">
            <span className="font-semibold text-[var(--neon-green)]">{t.testSession.keyword} </span>
            {result.keyword}
          </div>
        )}

        {!answered && (
          <Button
            className="w-full"
            size="lg"
            disabled={!selectedOptionId || checking}
            onClick={onCheckAnswer}
          >
            {checking ? t.testSession.checking : t.testSession.check}
          </Button>
        )}

        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            size="lg"
            disabled={!canGoPrev}
            onClick={onPrev}
          >
            {t.testSession.prev}
          </Button>
          <Button
            className="flex-1"
            variant={answered ? "default" : "outline"}
            size="lg"
            disabled={!canGoNext}
            onClick={onNext}
          >
            {t.testSession.next}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
