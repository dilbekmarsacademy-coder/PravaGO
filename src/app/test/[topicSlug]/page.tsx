"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkAnswer, getTopicQuestions, type ApiQuestion, type CheckAnswerResult } from "@/lib/api/test";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { FinishModal } from "@/components/test/FinishModal";
import { BottomSheet, MobileNavBar } from "@/components/test/MobileNavBar";
import { QuestionNavigator, type QuestionStatus } from "@/components/test/QuestionNavigator";
import { QuestionView, type TestMode } from "@/components/test/QuestionView";
import { ResultScreen } from "@/components/test/ResultScreen";
import { TestHeader } from "@/components/test/TestHeader";
import { TOPIC_TEST_TIME_LIMIT_SEC } from "@/config/rules";
import { COURSE_TOPICS } from "@/data/curriculum";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { clearSession, loadSession, saveSession, useBookmarks } from "@/lib/test/storage";
import { getTimeUrgency } from "@/lib/test/timer";

interface TestPageProps {
  params: Promise<{ topicSlug: string }>;
}

export default function TestPage({ params }: TestPageProps) {
  const { topicSlug } = use(params);
  // `attempt` remounts <TestSession> on restart so all quiz state resets
  // naturally, instead of imperatively clearing state inside an effect.
  const [attempt, setAttempt] = useState(0);
  // "Xatolarni qayta ishlash": faqat shu savollar bilan yangi urinish.
  const [onlyQuestionIds, setOnlyQuestionIds] = useState<string[] | null>(null);

  return (
    <MotionConfig reducedMotion="user">
      <TestSession
        key={attempt}
        topicSlug={topicSlug}
        onlyQuestionIds={onlyQuestionIds}
        onRestart={() => {
          setOnlyQuestionIds(null);
          setAttempt((a) => a + 1);
        }}
        onRetryWrong={(ids) => {
          setOnlyQuestionIds(ids);
          setAttempt((a) => a + 1);
        }}
      />
    </MotionConfig>
  );
}

interface TestSessionProps {
  topicSlug: string;
  onlyQuestionIds: string[] | null;
  onRestart: () => void;
  onRetryWrong: (questionIds: string[]) => void;
}

interface QuestionAnswer {
  selectedOptionId: string | null;
  result: CheckAnswerResult | null;
}

type FinishReason = "manual" | "timeout";

// Hozircha faqat mashq rejimi ishlatiladi; imtihon rejimi uslublari tayyor.
const MODE: TestMode = "practice";

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

function TestSession({ topicSlug, onlyQuestionIds, onRestart, onRetryWrong }: TestSessionProps) {
  const { locale, t } = useLocale();
  const [questions, setQuestions] = useState<ApiQuestion[] | null>(null);
  // Xato matni kalit sifatida saqlanadi — til almashsa ham to'g'ri tarjima chiqadi.
  const [error, setError] = useState<"loadError" | "checkError" | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});
  const [checking, setChecking] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [finishReason, setFinishReason] = useState<FinishReason | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const finished = finishReason !== null;
  // Sessiya faqat to'liq testda saqlanadi ("xatolarni qayta ishlash" — vaqtinchalik).
  const persist = onlyQuestionIds === null;
  const { bookmarks, toggle: toggleBookmark } = useBookmarks(topicSlug);

  const finish = useCallback((reason: FinishReason) => {
    setFinishReason((prev) => prev ?? reason);
    setFinishedAt((prev) => prev ?? Date.now());
    setFinishModalOpen(false);
    setSheetOpen(false);
  }, []);
  const handleTimeout = useCallback(() => finish("timeout"), [finish]);
  const remainingSec = useCountdown(startedAt, TOPIC_TEST_TIME_LIMIT_SEC, !finished, handleTimeout);
  const urgency = getTimeUrgency(remainingSec, TOPIC_TEST_TIME_LIMIT_SEC);

  const topic = COURSE_TOPICS.find((item) => item.testSlug === topicSlug);
  const topicTitle = topic ? localize(topic.title, locale) : null;
  const testLabel = topic ? t.kabinet.topic.testNo(topic.number) : null;

  useEffect(() => {
    let cancelled = false;
    getTopicQuestions(topicSlug)
      .then((data) => {
        if (cancelled) return;
        const list = onlyQuestionIds ? data.filter((q) => onlyQuestionIds.includes(q.id)) : data;
        setQuestions(list);
        const saved = persist ? loadSession(topicSlug, list.map((q) => q.id)) : null;
        if (saved) {
          // Sahifa yangilangan — javoblar, joriy savol va taymer davom etadi.
          const resolved = Object.fromEntries(Object.entries(saved.answers).filter(([, a]) => a.result));
          setAnswers(resolved);
          setCurrentIndex(Math.min(saved.currentIndex, list.length - 1));
          setStartedAt(saved.startedAt);
        } else {
          setStartedAt(Date.now());
        }
      })
      .catch(() => {
        if (!cancelled) setError("loadError");
      });
    return () => {
      cancelled = true;
    };
  }, [topicSlug, onlyQuestionIds, persist]);

  // Holatni sessionStorage'ga yozib boramiz; test tugagach tozalanadi.
  useEffect(() => {
    if (!persist || !questions || startedAt === null) return;
    if (finished) {
      clearSession(topicSlug);
      return;
    }
    const resolved = Object.fromEntries(Object.entries(answers).filter(([, a]) => a.result));
    saveSession(topicSlug, {
      v: 1,
      questionIds: questions.map((q) => q.id),
      answers: resolved,
      currentIndex,
      startedAt,
    });
  }, [persist, questions, startedAt, finished, answers, currentIndex, topicSlug]);

  const currentQuestion = questions?.[currentIndex] ?? null;
  const currentAnswer = answers[currentIndex] ?? { selectedOptionId: null, result: null };

  const statusByIndex = useMemo(() => {
    const map: Record<number, QuestionStatus> = {};
    for (const [index, answer] of Object.entries(answers)) {
      if (!answer.result) continue;
      map[Number(index)] = MODE === "exam" ? "answered" : answer.result.correct ? "correct" : "incorrect";
    }
    return map;
  }, [answers]);

  const bookmarkedIndexes = useMemo(
    () => new Set((questions ?? []).flatMap((q, i) => (bookmarks.has(q.id) ? [i] : []))),
    [questions, bookmarks],
  );

  const answeredCount = Object.keys(statusByIndex).length;
  const unansweredCount = questions ? questions.length - answeredCount : 0;

  const goTo = useCallback(
    (index: number) => {
      if (!questions) return;
      if (index < 0 || index >= questions.length) return;
      setDirection(index >= currentIndex ? 1 : -1);
      setCurrentIndex(index);
    },
    [questions, currentIndex],
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
            setTimeout(() => {
              setDirection(1);
              setCurrentIndex(index + 1);
            }, 1300);
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
      const fMatch = /^F([1-9])$/.exec(event.key);
      // F1 (yordam), F3 (qidiruv), F5 (yangilash) — brauzer amallarini doim bloklaymiz.
      if (fMatch && Number(fMatch[1]) <= 5) event.preventDefault();
      // Modal, bottom sheet yoki lightbox ochiq bo'lsa, test tugmalari ishlamaydi.
      if (document.querySelector('[aria-modal="true"]')) return;
      const match = fMatch ?? /^([1-9])$/.exec(event.key);
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

  const elapsedSec =
    startedAt !== null && finishedAt !== null
      ? Math.min(TOPIC_TEST_TIME_LIMIT_SEC, Math.round((finishedAt - startedAt) / 1000))
      : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Vaqt tugayotganini ekran chetlari rangi bilan bildiramiz. */}
      {!finished && urgency !== "normal" && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed inset-0 z-20 transition-shadow duration-500",
            urgency === "warning" && "shadow-[inset_0_0_0_3px_var(--warning),inset_0_0_60px_-10px_var(--warning)]",
            urgency === "critical" &&
              "animate-pulse shadow-[inset_0_0_0_4px_var(--danger),inset_0_0_90px_-10px_var(--danger)]",
          )}
        />
      )}
      {!finished && urgency !== "normal" && (
        <p className="sr-only" role="status">
          {t.testSession.timeRunningOut}
        </p>
      )}

      <TestHeader
        testLabel={testLabel}
        title={topicTitle}
        remainingSec={remainingSec}
        limitSec={TOPIC_TEST_TIME_LIMIT_SEC}
        urgency={urgency}
        canFinish={questions !== null && !finished}
        showTimer={!finished}
        onFinish={() => setFinishModalOpen(true)}
      />

      <main
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6",
          !finished && "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8",
        )}
      >
        {error && (
          <Card role="alert" className="flex items-center gap-3 border-danger/40 px-4 py-3">
            <TriangleAlertIcon className="size-5 shrink-0 text-danger" />
            <p className="flex-1 text-sm font-medium text-foreground">{t.testSession[error]}</p>
            {error === "loadError" && (
              <Button variant="secondary" size="sm" onClick={onRestart}>
                <RotateCcwIcon className="size-4" />
                {t.kabinet.loadError.retry}
              </Button>
            )}
          </Card>
        )}

        {!error && !questions && <TestSkeleton label={t.testSession.loading} />}

        {questions && !finished && currentQuestion && (
          <>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={currentQuestion.id}
                custom={direction}
                variants={{
                  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
                  center: { opacity: 1, x: 0 },
                  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <QuestionView
                  question={currentQuestion}
                  index={currentIndex}
                  total={questions.length}
                  mode={MODE}
                  selectedOptionId={currentAnswer.selectedOptionId}
                  result={currentAnswer.result}
                  checking={checking}
                  bookmarked={bookmarks.has(currentQuestion.id)}
                  videoHref={topic ? `/kabinet/mavzu/${topic.id}` : null}
                  onToggleBookmark={() => toggleBookmark(currentQuestion.id)}
                  onAnswer={handleAnswer}
                />
              </motion.div>
            </AnimatePresence>

            <Card className="hidden p-4 sm:p-5 md:block">
              <QuestionNavigator
                total={questions.length}
                currentIndex={currentIndex}
                statusByIndex={statusByIndex}
                bookmarkedIndexes={bookmarkedIndexes}
                onJump={goTo}
              />
            </Card>

            <MobileNavBar
              currentIndex={currentIndex}
              total={questions.length}
              onPrev={() => goTo(currentIndex - 1)}
              onNext={() => goTo(currentIndex + 1)}
              onOpenSheet={() => setSheetOpen(true)}
            />
            <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t.testSession.navigatorTitle}>
              <QuestionNavigator
                variant="sheet"
                total={questions.length}
                currentIndex={currentIndex}
                statusByIndex={statusByIndex}
                bookmarkedIndexes={bookmarkedIndexes}
                onJump={(index) => {
                  goTo(index);
                  setSheetOpen(false);
                }}
              />
            </BottomSheet>
          </>
        )}

        {questions && finishReason && (
          <ResultScreen
            reason={finishReason}
            mode={MODE}
            questions={questions}
            answers={answers}
            elapsedSec={elapsedSec}
            onRestart={onRestart}
            onRetryWrong={onRetryWrong}
          />
        )}
      </main>

      <FinishModal
        open={finishModalOpen && !finished}
        unanswered={unansweredCount}
        onContinue={() => setFinishModalOpen(false)}
        onFinish={() => finish("manual")}
      />
    </div>
  );
}

/** Yuklanish paytidagi skelet — haqiqiy joylashuvni takrorlaydi (layout shift yo'q). */
function TestSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="grid gap-5 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:gap-8">
      <span className="sr-only">{label}</span>
      <div className="skeleton-shimmer aspect-[16/9] rounded-2xl" />
      <div className="flex flex-col gap-3">
        <div className="skeleton-shimmer h-4 w-28 rounded-full" />
        <div className="skeleton-shimmer h-8 w-4/5 rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
