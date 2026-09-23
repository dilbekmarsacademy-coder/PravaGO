"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { checkAnswer, getTopicQuestions, type ApiQuestion, type CheckAnswerResult } from "@/lib/api/test";
import { ProgressBar } from "@/components/test/ProgressBar";
import { QuestionCard } from "@/components/test/QuestionCard";
import { QuestionGrid } from "@/components/test/QuestionGrid";
import { ResultSummary } from "@/components/test/ResultSummary";
import { Button } from "@/components/ui/button";

interface TestPageProps {
  params: Promise<{ topicSlug: string }>;
}

export default function TestPage({ params }: TestPageProps) {
  const { topicSlug } = use(params);
  // `attempt` remounts <TestSession> on restart so all quiz state resets
  // naturally, instead of imperatively clearing state inside an effect.
  const [attempt, setAttempt] = useState(0);

  return (
    <TestSession
      key={attempt}
      topicSlug={topicSlug}
      onRestart={() => setAttempt((a) => a + 1)}
    />
  );
}

interface TestSessionProps {
  topicSlug: string;
  onRestart: () => void;
}

interface QuestionAnswer {
  selectedOptionId: string | null;
  result: CheckAnswerResult | null;
}

function TestSession({ topicSlug, onRestart }: TestSessionProps) {
  const [questions, setQuestions] = useState<ApiQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});
  const [checking, setChecking] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTopicQuestions(topicSlug)
      .then((data) => {
        if (!cancelled) setQuestions(data);
      })
      .catch(() => {
        if (!cancelled) setError("Savollarni yuklab bo'lmadi. Qayta urinib ko'ring.");
      });
    return () => {
      cancelled = true;
    };
  }, [topicSlug]);

  const currentQuestion = questions?.[currentIndex] ?? null;
  const currentAnswer = answers[currentIndex] ?? { selectedOptionId: null, result: null };

  const resultsByIndex = useMemo(() => {
    const map: Record<number, CheckAnswerResult> = {};
    for (const [index, answer] of Object.entries(answers)) {
      if (answer.result) map[Number(index)] = answer.result;
    }
    return map;
  }, [answers]);

  const answeredCount = Object.keys(resultsByIndex).length;
  const allAnswered = questions !== null && answeredCount === questions.length;
  const correctCount = Object.values(resultsByIndex).filter((r) => r.correct).length;

  const goTo = useCallback(
    (index: number) => {
      if (!questions) return;
      if (index < 0 || index >= questions.length) return;
      setCurrentIndex(index);
    },
    [questions],
  );

  const handleSelectOption = useCallback(
    (optionId: string) => {
      setAnswers((prev) => ({
        ...prev,
        [currentIndex]: { selectedOptionId: optionId, result: null },
      }));
    },
    [currentIndex],
  );

  const handleCheckAnswer = useCallback(() => {
    if (!currentQuestion || !currentAnswer.selectedOptionId) return;
    const optionId = currentAnswer.selectedOptionId;
    const index = currentIndex;
    setChecking(true);
    checkAnswer(currentQuestion.id, optionId)
      .then((res) => {
        setAnswers((prev) => ({
          ...prev,
          [index]: { selectedOptionId: optionId, result: res },
        }));
        if (res.correct && questions && index + 1 < questions.length) {
          setTimeout(() => setCurrentIndex(index + 1), 1300);
        }
      })
      .catch(() => setError("Javobni tekshirib bo'lmadi. Qayta urinib ko'ring."))
      .finally(() => setChecking(false));
  }, [currentQuestion, currentAnswer.selectedOptionId, currentIndex, questions]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-8">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && !questions && (
        <p className="text-center text-muted-foreground">Yuklanmoqda...</p>
      )}

      {questions && !finished && currentQuestion && (
        <>
          <ProgressBar current={answeredCount} total={questions.length} />
          <QuestionGrid
            total={questions.length}
            currentIndex={currentIndex}
            results={resultsByIndex}
            onJump={goTo}
          />
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            selectedOptionId={currentAnswer.selectedOptionId}
            result={currentAnswer.result}
            checking={checking}
            canGoPrev={currentIndex > 0}
            canGoNext={currentIndex < questions.length - 1}
            onSelect={handleSelectOption}
            onCheckAnswer={handleCheckAnswer}
            onPrev={() => goTo(currentIndex - 1)}
            onNext={() => goTo(currentIndex + 1)}
          />

          <Button
            size="lg"
            disabled={!allAnswered}
            onClick={() => setFinished(true)}
          >
            {allAnswered
              ? "Yakunlash"
              : `Yakunlash uchun barcha savollarga javob bering (${answeredCount}/${questions.length})`}
          </Button>
        </>
      )}

      {questions && finished && (
        <ResultSummary correctCount={correctCount} total={questions.length} onRestart={onRestart} />
      )}
    </main>
  );
}
