"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { checkAnswer, getTopicQuestions, type ApiQuestion, type CheckAnswerResult } from "@/lib/api/test";
import { QuestionCard } from "@/components/test/QuestionCard";
import { QuestionGrid } from "@/components/test/QuestionGrid";
import { ResultSummary } from "@/components/test/ResultSummary";
import { TestTopBar } from "@/components/test/TestTopBar";
import { TimeUpSummary } from "@/components/test/TimeUpSummary";
import { TOPIC_TEST_TIME_LIMIT_SEC } from "@/config/rules";
import { getTimeUrgency } from "@/lib/test/timer";
import { COURSE_TOPICS } from "@/data/curriculum";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";

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

type FinishReason = "manual" | "timeout";

/**
 * Qolgan vaqt (soniya). `startedAt` — savollar yuklangan payt; vaqt tugashi
 * bilan `onExpire` bir marta chaqiriladi. Hisob `Date.now()` bo'yicha —
 * tab fonda qolsa ham vaqt to'g'ri o'tadi.
 */
function useCountdown(startedAt: number | null, limitSec: number, running: boolean, onExpire: () => void) {
  const [now, setNow] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (startedAt === null || !running) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current - startedAt >= limitSec * 1000) onExpireRef.current();
    }, 250);
    return () => clearInterval(id);
  }, [startedAt, limitSec, running]);

  if (startedAt === null || now === null) return limitSec;
  return Math.max(0, limitSec - Math.floor((now - startedAt) / 1000));
}

function TestSession({ topicSlug, onRestart }: TestSessionProps) {
  const { locale, t } = useLocale();
  const [questions, setQuestions] = useState<ApiQuestion[] | null>(null);
  // Xato matni kalit sifatida saqlanadi — til almashsa ham to'g'ri tarjima chiqadi.
  const [error, setError] = useState<"loadError" | "checkError" | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});
  const [checking, setChecking] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [finishReason, setFinishReason] = useState<FinishReason | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const finished = finishReason !== null;
  const handleTimeout = useCallback(() => setFinishReason((prev) => prev ?? "timeout"), []);
  const remainingSec = useCountdown(startedAt, TOPIC_TEST_TIME_LIMIT_SEC, !finished, handleTimeout);
  const urgency = getTimeUrgency(remainingSec, TOPIC_TEST_TIME_LIMIT_SEC);

  const topic = COURSE_TOPICS.find((item) => item.testSlug === topicSlug);
  const title = topic ? `${t.kabinet.topic.testNo(topic.number)} · ${localize(topic.title, locale)}` : null;

  useEffect(() => {
    let cancelled = false;
    getTopicQuestions(topicSlug)
      .then((data) => {
        if (cancelled) return;
        setQuestions(data);
        setStartedAt(Date.now());
      })
      .catch(() => {
        if (!cancelled) setError("loadError");
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
  const unansweredCount = questions ? questions.length - answeredCount : 0;
  const correctCount = Object.values(resultsByIndex).filter((r) => r.correct).length;

  const goTo = useCallback(
    (index: number) => {
      if (!questions) return;
      if (index < 0 || index >= questions.length) return;
      setCurrentIndex(index);
    },
    [questions],
  );

  // Haqiqiy imtihondagidek: variantni tanlash — javobni darhol tekshirish.
  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!currentQuestion || checking || currentAnswer.result) return;
      const index = currentIndex;
      setAnswers((prev) => ({ ...prev, [index]: { selectedOptionId: optionId, result: null } }));
      setChecking(true);
      checkAnswer(currentQuestion.id, optionId)
        .then((res) => {
          setAnswers((prev) => ({ ...prev, [index]: { selectedOptionId: optionId, result: res } }));
          if (res.correct && questions && index + 1 < questions.length) {
            setTimeout(() => setCurrentIndex(index + 1), 1300);
          }
        })
        .catch(() => {
          setAnswers((prev) => ({ ...prev, [index]: { selectedOptionId: null, result: null } }));
          setError("checkError");
        })
        .finally(() => setChecking(false));
    },
    [currentQuestion, checking, currentAnswer.result, currentIndex, questions],
  );

  // Klaviatura: F1–F9 yoki 1–9 — variant tanlash, ←/→ — savollar orasida yurish.
  useEffect(() => {
    if (!currentQuestion || finished) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const match = /^F([1-9])$/.exec(event.key) ?? /^([1-9])$/.exec(event.key);
      if (match) {
        const option = currentQuestion?.options[Number(match[1]) - 1];
        if (option) {
          event.preventDefault();
          handleAnswer(option.id);
        }
      } else if (event.key === "ArrowLeft") {
        goTo(currentIndex - 1);
      } else if (event.key === "ArrowRight") {
        goTo(currentIndex + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentQuestion, finished, handleAnswer, goTo, currentIndex]);

  function handleFinish() {
    if (unansweredCount > 0) {
      setConfirmingFinish(true);
    } else {
      setFinishReason("manual");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Vaqt tugayotganini ekran chetlari rangi bilan bildiramiz. */}
      {!finished && urgency !== "normal" && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed inset-0 z-30 transition-shadow duration-500",
            urgency === "warning" && "shadow-[inset_0_0_0_3px_var(--neon-amber),inset_0_0_60px_-10px_var(--neon-amber)]",
            urgency === "critical" &&
              "animate-pulse shadow-[inset_0_0_0_4px_var(--neon-red),inset_0_0_90px_-10px_var(--neon-red)]",
          )}
        />
      )}
      {!finished && urgency !== "normal" && (
        <p className="sr-only" role="status">
          {t.testSession.timeRunningOut}
        </p>
      )}

      <TestTopBar
        title={title}
        remainingSec={remainingSec}
        urgency={urgency}
        canFinish={questions !== null && !finished}
        onFinish={handleFinish}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        {error && (
          <div className="rounded-xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {t.testSession[error]}
          </div>
        )}

        {!error && !questions && (
          <p className="py-16 text-center text-muted-foreground">{t.testSession.loading}</p>
        )}

        {confirmingFinish && !finished && (
          <div className="flex flex-col gap-3 rounded-xl border border-neon-amber/40 bg-neon-amber/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">
              {t.testSession.finishConfirm(unansweredCount)}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingFinish(false)}
                className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t.testSession.cancel}
              </button>
              <button
                type="button"
                onClick={() => setFinishReason("manual")}
                className="rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-4 py-1.5 text-sm font-bold text-background"
              >
                {t.testSession.finishConfirmYes}
              </button>
            </div>
          </div>
        )}

        {questions && !finished && currentQuestion && (
          <>
            <QuestionCard
              key={currentQuestion.id}
              question={currentQuestion}
              selectedOptionId={currentAnswer.selectedOptionId}
              result={currentAnswer.result}
              checking={checking}
              onAnswer={handleAnswer}
            />
            <QuestionGrid
              total={questions.length}
              currentIndex={currentIndex}
              results={resultsByIndex}
              onJump={goTo}
            />
          </>
        )}

        {questions && finished && (
          <div className="mx-auto w-full max-w-xl">
            {finishReason === "timeout" ? (
              <TimeUpSummary correctCount={correctCount} total={questions.length} />
            ) : (
              <ResultSummary correctCount={correctCount} total={questions.length} onRestart={onRestart} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
