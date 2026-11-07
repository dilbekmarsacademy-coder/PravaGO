"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RANDOM_CHUNK,
  RANDOM_TEST_ALREADY_ANSWERED,
  RANDOM_TEST_FINISHED,
  RANDOM_TEST_TIME_UP,
  answerRandomQuestion,
  finishRandomTest,
  getRandomQuestions,
  type RandomQuestion,
  type RandomTestState,
} from "@/lib/api/random-tests";
import { ApiError } from "@/lib/api/session";
import { topicBySlug } from "@/lib/saved/format";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { toggleSavedWithFeedback } from "@/lib/saved/actions";
import { loadSavedIds, useSavedState } from "@/lib/saved/store";
import { getTimeUrgency } from "@/lib/test/timer";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { AnswerConfirmBar } from "@/components/test/AnswerConfirmBar";
import { FinishModal } from "@/components/test/FinishModal";
import { BottomSheet, MobileNavBar } from "@/components/test/MobileNavBar";
import { QuestionNavigator, type QuestionStatus } from "@/components/test/QuestionNavigator";
import { QuestionView } from "@/components/test/QuestionView";
import { TestHeader } from "@/components/test/TestHeader";

interface RandomTestSessionProps {
  initial: RandomTestState;
  /** Test tugadi (yakunlandi, vaqt tugadi yoki hamma savolga javob berildi) — natija ekraniga. */
  onFinished: (state: RandomTestState) => void;
}

/** Oxirgi javobdan keyin natijagacha — javob rangi ko'rinib ulgurishi uchun (ms). */
const AUTO_FINISH_DELAY_MS = 900;

/**
 * Qolgan vaqt (soniya). `deadline` — server bergan `remainingMs` bo'yicha
 * mahalliy muddat (klient soati noto'g'ri bo'lsa ham to'g'ri). Faqat ko'rsatish
 * uchun — muddatni server tekshiradi. Soniyada bir marta yangilanadi, so'rov yubormaydi.
 */
function useDeadline(deadline: number, running: boolean, onExpire: () => void): number {
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) onExpireRef.current();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, running]);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function RandomTestSession({ initial, onFinished }: RandomTestSessionProps) {
  const { locale, t } = useLocale();
  const labels = t.kabinet.randomTest;
  const [state, setState] = useState(initial);
  const [deadline, setDeadline] = useState(() => Date.now() + initial.remainingMs);
  const [questions, setQuestions] = useState<Record<number, RandomQuestion>>({});
  const loadingChunks = useRef(new Set<number>());
  // Birinchi javob berilmagan savoldan davom etiladi (sahifa yangilanganda).
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, initial.items.findIndex((i) => !i.answered)));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [pending, setPending] = useState<{ index: number; optionId: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const { ids: savedIds } = useSavedState();
  const total = state.total;
  const limitSec = total * 60;

  useEffect(() => {
    loadSavedIds({ force: true }).catch(() => undefined);
  }, []);

  const finish = useCallback(() => {
    if (finishing) return;
    setFinishing(true);
    setPending(null);
    setFinishModalOpen(false);
    finishRandomTest(state.id)
      .then(onFinished)
      .catch(() => {
        setFinishing(false);
        setError(labels.loadError);
      });
  }, [finishing, state.id, onFinished, labels.loadError]);

  const remainingSec = useDeadline(deadline, !finishing, finish);
  const urgency = getTimeUrgency(remainingSec, limitSec);

  // Savollar bo'laklab yuklanadi: joriy savol bo'lagi va (oxiriga yaqinlashganda) keyingisi.
  const ensureChunk = useCallback(
    (index: number) => {
      const start = Math.floor(index / RANDOM_CHUNK) * RANDOM_CHUNK;
      if (start < 0 || start >= total || questions[start] || loadingChunks.current.has(start)) return;
      loadingChunks.current.add(start);
      getRandomQuestions(state.id, start)
        .then((rows) => setQuestions((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.position, r])) })))
        .catch(() => setError(labels.loadError))
        .finally(() => loadingChunks.current.delete(start));
    },
    [questions, state.id, total, labels.loadError],
  );

  useEffect(() => {
    ensureChunk(currentIndex);
    if (currentIndex % RANDOM_CHUNK >= RANDOM_CHUNK - 5) ensureChunk(currentIndex + 5);
  }, [currentIndex, ensureChunk]);

  const current = questions[currentIndex] ?? null;
  const currentQuestion = current?.question ?? null;
  const review = current?.review ?? null;

  const statusByIndex = useMemo(() => {
    const map: Record<number, QuestionStatus> = {};
    state.items.forEach((item, i) => {
      if (item.answered) map[i] = item.correct ? "correct" : "incorrect";
    });
    return map;
  }, [state.items]);

  const bookmarkedIndexes = useMemo(
    () => new Set(Object.values(questions).flatMap((q) => (savedIds.has(q.question.id) ? [q.position] : []))),
    [questions, savedIds],
  );

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= total || index === currentIndex) return;
      setDirection(index >= currentIndex ? 1 : -1);
      setCurrentIndex(index);
      setPending(null);
    },
    [total, currentIndex],
  );

  // Variant bosilganda — avval tasdiqlash oynasi (tasodifan bosib yuborishdan himoya).
  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!currentQuestion || checking || review || finishing) return;
      setPending({ index: currentIndex, optionId });
    },
    [currentQuestion, checking, review, finishing, currentIndex],
  );

  const confirmAnswer = useCallback(() => {
    if (!pending || pending.index !== currentIndex || !current || checking || review) return;
    const { index, optionId } = pending;
    setPending(null);
    setChecking(true);
    setError(null);
    answerRandomQuestion(state.id, index, optionId)
      .then(({ review: result, state: next }) => {
        setQuestions((prev) => ({ ...prev, [index]: { ...prev[index], review: result } }));
        setState(next);
        setDeadline(Date.now() + next.remainingMs);
        if (next.status !== "in_progress") {
          setTimeout(() => onFinished(next), AUTO_FINISH_DELAY_MS);
          return;
        }
        if (result.correct && index + 1 < total) {
          setTimeout(() => {
            setDirection(1);
            setCurrentIndex((i) => (i === index ? index + 1 : i));
          }, 1300);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.code === RANDOM_TEST_TIME_UP || err.code === RANDOM_TEST_FINISHED)) {
          setError(labels.answerTimeUp);
          finish();
          return;
        }
        if (err instanceof ApiError && err.code === RANDOM_TEST_ALREADY_ANSWERED) {
          // Boshqa oynada javob berilgan — natija bilan qayta yuklaymiz.
          getRandomQuestions(state.id, index, 1)
            .then((rows) => rows[0] && setQuestions((prev) => ({ ...prev, [index]: rows[0] })))
            .catch(() => undefined);
          return;
        }
        setError(t.testSession.checkError);
      })
      .finally(() => setChecking(false));
  }, [pending, currentIndex, current, checking, review, state.id, total, onFinished, finish, labels.answerTimeUp, t.testSession.checkError]);

  const pendingOptionId = pending && pending.index === currentIndex && !review ? pending.optionId : null;
  const pendingIndex = pendingOptionId && currentQuestion ? currentQuestion.options.findIndex((o) => o.id === pendingOptionId) : -1;
  const pendingChoice =
    currentQuestion && pendingIndex >= 0 ? { label: `F${pendingIndex + 1}`, text: localize(currentQuestion.options[pendingIndex].text, locale) } : null;

  const toggleSaved = useCallback(() => {
    if (!current) return;
    toggleSavedWithFeedback(current.question.id, { topicSlug: current.topicSlug, sourceMode: "practice" }, t);
  }, [current, t]);

  // Klaviatura: 1–9 / F1–F9 — variant, ←/→ — savollar, Enter — "Ha", Escape — "Yo'q".
  useEffect(() => {
    if (!currentQuestion || finishing) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const fMatch = /^F([1-9])$/.exec(event.key);
      if (fMatch && Number(fMatch[1]) <= 5) event.preventDefault();
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (pendingOptionId && (event.key === "Enter" || event.key === "Escape")) {
        if (event.key === "Enter" && target?.closest("button")) return;
        event.preventDefault();
        if (event.key === "Enter") confirmAnswer();
        else setPending(null);
        return;
      }
      const match = fMatch ?? /^([1-9])$/.exec(event.key);
      if (match) {
        const option = currentQuestion?.options[Number(match[1]) - 1];
        if (option) {
          event.preventDefault();
          handleAnswer(option.id);
        }
      } else if (event.key === "ArrowLeft") goTo(currentIndex - 1);
      else if (event.key === "ArrowRight") goTo(currentIndex + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentQuestion, finishing, pendingOptionId, confirmAnswer, handleAnswer, goTo, currentIndex]);

  const topic = current ? topicBySlug(current.topicSlug) : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      {urgency !== "normal" && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed inset-0 z-20 transition-shadow duration-500",
            urgency === "warning" && "shadow-[inset_0_0_0_3px_var(--warning),inset_0_0_60px_-10px_var(--warning)]",
            urgency === "critical" && "animate-pulse shadow-[inset_0_0_0_4px_var(--danger),inset_0_0_90px_-10px_var(--danger)]",
          )}
        />
      )}

      <TestHeader
        testLabel={labels.title}
        title={labels.sessionTitle(total)}
        backHref="/kabinet/random"
        remainingSec={remainingSec}
        limitSec={limitSec}
        urgency={urgency}
        canFinish={!finishing}
        showTimer
        onFinish={() => setFinishModalOpen(true)}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:pb-8">
        {error && (
          <Card role="alert" className="flex items-center gap-3 border-danger/40 px-4 py-3">
            <TriangleAlertIcon className="size-5 shrink-0 text-danger" />
            <p className="flex-1 text-sm font-medium text-foreground">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                ensureChunk(currentIndex);
              }}
            >
              <RotateCcwIcon className="size-4" />
              {labels.retry}
            </Button>
          </Card>
        )}

        {!currentQuestion ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <span className="sr-only">{t.testSession.loading}</span>
            <div className="skeleton-shimmer h-8 w-4/5 rounded-xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={current!.position}
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
                total={total}
                mode="practice"
                selectedOptionId={review?.selectedOptionId ?? pendingOptionId}
                result={review}
                checking={checking}
                bookmarked={savedIds.has(currentQuestion.id)}
                videoHref={topic ? `/kabinet/mavzu/${topic.id}` : null}
                onToggleBookmark={toggleSaved}
                onAnswer={handleAnswer}
              />
            </motion.div>
          </AnimatePresence>
        )}

        <AnswerConfirmBar choice={pendingChoice} onConfirm={confirmAnswer} onCancel={() => setPending(null)} />

        <Card className="hidden p-4 sm:p-5 md:block">
          <QuestionNavigator total={total} currentIndex={currentIndex} statusByIndex={statusByIndex} bookmarkedIndexes={bookmarkedIndexes} onJump={goTo} />
        </Card>

        <MobileNavBar currentIndex={currentIndex} total={total} onPrev={() => goTo(currentIndex - 1)} onNext={() => goTo(currentIndex + 1)} onOpenSheet={() => setSheetOpen(true)} />
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t.testSession.navigatorTitle}>
          <QuestionNavigator
            variant="sheet"
            total={total}
            currentIndex={currentIndex}
            statusByIndex={statusByIndex}
            bookmarkedIndexes={bookmarkedIndexes}
            onJump={(index) => {
              goTo(index);
              setSheetOpen(false);
            }}
          />
        </BottomSheet>
      </main>

      <FinishModal
        open={finishModalOpen}
        unanswered={state.unanswered}
        remainingSec={remainingSec}
        correct={state.correct}
        total={total}
        onContinue={() => setFinishModalOpen(false)}
        onFinish={finish}
      />
    </div>
  );
}
