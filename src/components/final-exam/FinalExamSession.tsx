"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FlagIcon, RotateCcwIcon, TriangleAlertIcon, WifiOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXAM_TYPE_LABEL,
  FINAL_EXAM_ALREADY_ANSWERED,
  FINAL_EXAM_FINISHED,
  FINAL_EXAM_TIME_UP,
  answerFinalQuestion,
  finishFinalExam,
  formatPercent,
  getFinalQuestions,
  skipFinalQuestion,
  type AttemptState,
  type ExamQuestion,
} from "@/lib/api/final-exam";
import { ApiError } from "@/lib/api/session";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatClock, getTimeUrgency } from "@/lib/test/timer";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Modal } from "@/components/shared/Modal";
import { AnswerConfirmBar } from "@/components/test/AnswerConfirmBar";
import { BottomSheet, MobileNavBar } from "@/components/test/MobileNavBar";
import { QuestionNavigator, type QuestionStatus } from "@/components/test/QuestionNavigator";
import { QuestionView } from "@/components/test/QuestionView";
import { TestHeader } from "@/components/test/TestHeader";

interface FinalExamSessionProps {
  initial: AttemptState;
  /** Imtihon tugadi (yakunlandi, vaqt tugadi yoki hamma savolga javob berildi). */
  onFinished: (state: AttemptState) => void;
}

/**
 * Qolgan vaqt (soniya) — server bergan `remainingMs` bo'yicha mahalliy muddat.
 * Faqat ko'rsatish uchun: muddatni server tekshiradi.
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

/** "7/10 urinish · hozirgi o'rtacha: 97,4%" */
export function attemptsLine(state: Pick<AttemptState, "attemptNo" | "maxAttempts" | "average">): string {
  const avg = state.average === null ? "hali yo'q" : formatPercent(state.average);
  return `${state.attemptNo ?? "–"}/${state.maxAttempts} urinish · hozirgi o'rtacha: ${avg}`;
}

export function FinalExamSession({ initial, onFinished }: FinalExamSessionProps) {
  const { locale, t } = useLocale();
  const [state, setState] = useState(initial);
  const [deadline, setDeadline] = useState(() => Date.now() + initial.remainingMs);
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, initial.items.findIndex((i) => !i.answered)));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [pending, setPending] = useState<{ index: number; optionId: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const total = state.total;

  const loadQuestions = useCallback(() => {
    setError(null);
    getFinalQuestions(initial.id)
      .then(setQuestions)
      .catch(() => setError({ message: "Savollarni yuklab bo'lmadi. Internet aloqasini tekshiring.", retry: loadQuestions }));
  }, [initial.id]);

  useEffect(() => {
     
    loadQuestions();
  }, [loadQuestions]);

  const finish = useCallback(() => {
    if (finishing) return;
    setFinishing(true);
    setPending(null);
    setFinishModalOpen(false);
    finishFinalExam(state.id)
      .then(onFinished)
      .catch(() => {
        setFinishing(false);
        setError({ message: "Imtihonni yakunlab bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.", retry: finish });
      });
  }, [finishing, state.id, onFinished]);

  // Vaqt tugadi — server ham urinishni yopadi (javobsizlar xato).
  const remainingSec = useDeadline(deadline, !finishing, finish);
  const urgency = getTimeUrgency(remainingSec, state.limitSec);

  const current = questions?.[currentIndex] ?? null;
  const currentQuestion = current?.question ?? null;
  const answeredId = current?.selectedOptionId ?? null;

  const statusByIndex = useMemo(() => {
    const map: Record<number, QuestionStatus> = {};
    state.items.forEach((item, i) => {
      if (item.answered) map[i] = "answered";
    });
    return map;
  }, [state.items]);

  const goTo = useCallback(
    (index: number) => {
      if (!questions || index < 0 || index >= total || index === currentIndex) return;
      // Javobsiz tashlab ketilyapti — server variantlarni qayta aralashtiradi (qaytganda boshqa joyda).
      const leaving = questions[currentIndex];
      if (leaving && !leaving.selectedOptionId && !leaving.question.orderLocked) {
        const position = leaving.position;
        skipFinalQuestion(state.id, position)
          .then(({ optionOrder }) =>
            setQuestions((prev) =>
              prev?.map((q) => {
                if (q.position !== position || q.selectedOptionId) return q;
                const byId = new Map(q.question.options.map((o) => [o.id, o]));
                return { ...q, question: { ...q.question, options: optionOrder.flatMap((id) => byId.get(id) ?? []) } };
              }) ?? prev,
            ),
          )
          .catch(() => undefined);
      }
      setDirection(index >= currentIndex ? 1 : -1);
      setCurrentIndex(index);
      setPending(null);
    },
    [questions, total, currentIndex, state.id],
  );

  // Variant bosilganda — avval tasdiqlash (tasodifan bosib yuborishdan himoya).
  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!currentQuestion || checking || answeredId || finishing) return;
      setPending({ index: currentIndex, optionId });
    },
    [currentQuestion, checking, answeredId, finishing, currentIndex],
  );

  const confirmAnswer = useCallback(() => {
    if (!pending || pending.index !== currentIndex || !current || checking || answeredId) return;
    const { index, optionId } = pending;
    setPending(null);
    setChecking(true);
    setError(null);
    answerFinalQuestion(state.id, index, optionId)
      .then((next) => {
        setQuestions((prev) => prev?.map((q) => (q.position === index ? { ...q, selectedOptionId: optionId } : q)) ?? prev);
        setState(next);
        setDeadline(Date.now() + next.remainingMs);
        if (next.status !== "IN_PROGRESS") {
          setFinishing(true);
          setTimeout(() => onFinished(next), 500);
          return;
        }
        // Keyingi javobsiz savolga.
        const after = next.items.findIndex((item, i) => i > index && !item.answered);
        const target = after >= 0 ? after : next.items.findIndex((item) => !item.answered);
        if (target >= 0) {
          setTimeout(() => {
            setDirection(target > index ? 1 : -1);
            setCurrentIndex((i) => (i === index ? target : i));
          }, 350);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.code === FINAL_EXAM_TIME_UP || err.code === FINAL_EXAM_FINISHED)) {
          setError({ message: "Vaqt tugadi — imtihon avtomatik yakunlandi." });
          finish();
          return;
        }
        if (err instanceof ApiError && err.code === FINAL_EXAM_ALREADY_ANSWERED) {
          // Boshqa oyna/qurilmada javob berilgan — savollarni qayta yuklaymiz.
          loadQuestions();
          return;
        }
        setError({ message: "Javob saqlanmadi — internet aloqasini tekshirib, qayta tanlang." });
      })
      .finally(() => setChecking(false));
  }, [pending, currentIndex, current, checking, answeredId, state.id, onFinished, finish, loadQuestions]);

  const pendingOptionId = pending && pending.index === currentIndex && !answeredId ? pending.optionId : null;
  const pendingIndex = pendingOptionId && currentQuestion ? currentQuestion.options.findIndex((o) => o.id === pendingOptionId) : -1;
  const pendingChoice =
    currentQuestion && pendingIndex >= 0 ? { label: `F${pendingIndex + 1}`, text: localize(currentQuestion.options[pendingIndex].text, locale) } : null;

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

  const unanswered = state.items.filter((i) => !i.answered).length;

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
        testLabel="Yakuniy imtihon"
        title={`${EXAM_TYPE_LABEL[state.type]} · ${state.attemptNo ?? "–"}-urinish`}
        backHref="/kabinet/imtihon"
        remainingSec={remainingSec}
        limitSec={state.limitSec}
        urgency={urgency}
        canFinish={!finishing}
        showTimer
        onFinish={() => setFinishModalOpen(true)}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/30 bg-brand/[0.06] px-4 py-2.5 text-sm" data-testid="exam-attempts-line">
          <span className="font-semibold text-foreground">{attemptsLine(state)}</span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            Javob berilgan: {total - unanswered}/{total}
          </span>
        </div>

        {error && (
          <Card role="alert" className="flex items-center gap-3 border-danger/40 px-4 py-3">
            {error.retry ? <WifiOffIcon className="size-5 shrink-0 text-danger" /> : <TriangleAlertIcon className="size-5 shrink-0 text-danger" />}
            <p className="flex-1 text-sm font-medium text-foreground">{error.message}</p>
            {error.retry && (
              <Button variant="secondary" size="sm" onClick={error.retry}>
                <RotateCcwIcon className="size-4" />
                Qayta urinish
              </Button>
            )}
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
                mode="exam"
                selectedOptionId={answeredId ?? pendingOptionId}
                result={null}
                checking={checking}
                bookmarked={false}
                hideBookmark
                videoHref={null}
                onToggleBookmark={() => undefined}
                onAnswer={handleAnswer}
              />
            </motion.div>
          </AnimatePresence>
        )}

        <AnswerConfirmBar choice={pendingChoice} onConfirm={confirmAnswer} onCancel={() => setPending(null)} />

        <Card className="hidden p-4 sm:p-5 md:block">
          <QuestionNavigator total={total} currentIndex={currentIndex} statusByIndex={statusByIndex} bookmarkedIndexes={new Set()} onJump={goTo} />
        </Card>

        <MobileNavBar currentIndex={currentIndex} total={total} onPrev={() => goTo(currentIndex - 1)} onNext={() => goTo(currentIndex + 1)} onOpenSheet={() => setSheetOpen(true)} />
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t.testSession.navigatorTitle}>
          <QuestionNavigator
            variant="sheet"
            total={total}
            currentIndex={currentIndex}
            statusByIndex={statusByIndex}
            bookmarkedIndexes={new Set()}
            onJump={(index) => {
              goTo(index);
              setSheetOpen(false);
            }}
          />
        </BottomSheet>
      </main>

      <Modal
        open={finishModalOpen}
        onOpenChange={setFinishModalOpen}
        icon={
          <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
            <FlagIcon className="size-5" />
          </span>
        }
        title="Imtihonni yakunlaysizmi?"
        description={
          unanswered > 0
            ? `${unanswered} ta savolga javob berilmagan — ular xato hisoblanadi. Yakunlangan urinishni qayta ochib bo'lmaydi.`
            : "Barcha savollarga javob berdingiz. Yakunlangan urinishni qayta ochib bo'lmaydi."
        }
      >
        <dl className="mb-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Qolgan vaqt</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-foreground tabular-nums">{formatClock(remainingSec)}</dd>
          </div>
          <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Javob berilgan</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-foreground tabular-nums">
              {total - unanswered}/{total}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={finish} data-testid="exam-finish-confirm">
            Yakunlash
          </Button>
          <Button variant="primary" size="md" onClick={() => setFinishModalOpen(false)} autoFocus>
            Davom etish
          </Button>
        </div>
      </Modal>
    </div>
  );
}
