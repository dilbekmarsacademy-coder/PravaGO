"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightIcon, FlagIcon, OctagonXIcon, RotateCcwIcon, TriangleAlertIcon, WifiOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXAM_TYPE_LABEL,
  FINAL_EXAM_ALREADY_ANSWERED,
  FINAL_EXAM_FAILED,
  FINAL_EXAM_FINISHED,
  FINAL_EXAM_TIME_UP,
  answerFinalQuestion,
  finishFinalExam,
  formatPercent,
  getFinalAttempt,
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
import { selectAnswer } from "@/lib/test/answer-confirm";
import { useSkipAnswerConfirm } from "@/lib/test/useSkipAnswerConfirm";
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

/** Imtihonda variant tanlangach natija shuncha vaqt ko'rinib turadi, keyin natija ekrani. */
const LAST_FEEDBACK_MS = 1400;
const FAILED_FEEDBACK_MS = 2200;

/** "Xatolar: 1 / 3" — taymer yonida doim ko'rinadi. */
function MistakesBadge({ wrong, max, className, testId = "exam-mistakes" }: { wrong: number; max: number; className?: string; testId?: string }) {
  const left = max - wrong;
  return (
    <span
      data-testid={testId}
      aria-live="polite"
      title={left > 0 ? `Yana ${left} ta xatoda imtihon to'xtaydi` : "Xatolar chegarasi"}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 font-mono text-xs font-semibold whitespace-nowrap tabular-nums",
        className,
        wrong === 0 && "border-border text-muted-foreground",
        wrong > 0 && wrong < max - 1 && "border-warning/50 bg-warning/10 text-warning",
        wrong >= max - 1 && "border-danger/50 bg-danger/10 text-danger",
      )}
    >
      <OctagonXIcon className="size-3.5" aria-hidden="true" />
      Xatolar: {wrong} / {max}
    </span>
  );
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
  const skipAnswerConfirm = useSkipAnswerConfirm();
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
      if (item.answered) map[i] = item.correct === true ? "correct" : item.correct === false ? "incorrect" : "answered";
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

  const submitAnswer = useCallback((index: number, optionId: string) => {
    if (index !== currentIndex || !current || checking || answeredId) return;
    setPending(null);
    setChecking(true);
    setError(null);
    answerFinalQuestion(state.id, index, optionId)
      .then(({ feedback, ...next }) => {
        // Javob saqlandi — endi shu savolning to'g'ri varianti ma'lum (yashil/qizil).
        setQuestions(
          (prev) =>
            prev?.map((q) =>
              q.position === index
                ? { ...q, selectedOptionId: optionId, feedback: { selectedOptionId: optionId, correct: feedback.correct, correctOptionId: feedback.correctOptionId } }
                : q,
            ) ?? prev,
        );
        setState(next);
        setDeadline(Date.now() + next.remainingMs);
        if (next.status !== "IN_PROGRESS") {
          // 3-xato (FAILED) yoki hamma savolga javob berildi — natija qisqa ko'rinib turadi, keyin natija ekrani.
          setFinishing(true);
          setTimeout(() => onFinished(next), next.status === "FAILED" ? FAILED_FEEDBACK_MS : LAST_FEEDBACK_MS);
        }
        // Javob o'zgartirilmaydi; keyingi savolga — "Keyingi savol" tugmasi (yoki Enter / →).
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.code === FINAL_EXAM_TIME_UP || err.code === FINAL_EXAM_FINISHED)) {
          setError({ message: "Vaqt tugadi — imtihon avtomatik yakunlandi." });
          finish();
          return;
        }
        if (err instanceof ApiError && err.code === FINAL_EXAM_FAILED) {
          // Boshqa oynada 3-xato qilingan — urinish allaqachon yakunlangan.
          setFinishing(true);
          getFinalAttempt(state.id)
            .then(onFinished)
            .catch(() => finish());
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
  }, [currentIndex, current, checking, answeredId, state.id, onFinished, finish, loadQuestions]);

  // "Ha" — tanlangan javob qabul qilinadi.
  const confirmAnswer = useCallback(() => {
    if (pending) submitAnswer(pending.index, pending.optionId);
  }, [pending, submitAnswer]);

  // Variant bosilganda — avval tasdiqlash (tasodifan bosib yuborishdan himoya).
  // Ro'yxatdagi foydalanuvchida (GET /me → skipAnswerConfirm) panel chiqmaydi — javob darhol qabul qilinadi.
  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!currentQuestion || checking || answeredId || finishing) return;
      const selection = selectAnswer(skipAnswerConfirm, currentIndex, optionId);
      if (selection.kind === "submit") submitAnswer(selection.index, selection.optionId);
      else setPending({ index: selection.index, optionId: selection.optionId });
    },
    [currentQuestion, checking, answeredId, finishing, currentIndex, skipAnswerConfirm, submitAnswer],
  );

  /** Javobdan keyin: keyingi javobsiz savol (oldinga, keyin boshidan). */
  const nextUnanswered = useMemo(() => {
    const after = state.items.findIndex((item, i) => i > currentIndex && !item.answered);
    const target = after >= 0 ? after : state.items.findIndex((item) => !item.answered);
    return target >= 0 && target !== currentIndex ? target : null;
  }, [state.items, currentIndex]);

  const goNext = useCallback(() => {
    if (nextUnanswered !== null) goTo(nextUnanswered);
  }, [nextUnanswered, goTo]);

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
      if (answeredId && !pendingOptionId && event.key === "Enter" && !target?.closest("button")) {
        event.preventDefault();
        goNext();
        return;
      }
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
  }, [currentQuestion, finishing, pendingOptionId, confirmAnswer, handleAnswer, goTo, goNext, answeredId, currentIndex]);

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
        // Telefonda header'ga sig'maydi — pastki panelda ko'rsatiladi.
        extra={<MistakesBadge wrong={state.wrongCount ?? 0} max={state.maxMistakes ?? 3} className="hidden md:inline-flex" />}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:pb-8">
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
                examFeedback={current?.feedback ?? null}
              />
            </motion.div>
          </AnimatePresence>
        )}

        {state.status === "FAILED" && (
          <div role="alert" data-testid="exam-failed" className="flex items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3">
            <OctagonXIcon className="size-5 shrink-0 text-danger" />
            <p className="flex-1 text-sm font-medium text-foreground">
              {state.maxMistakes} ta xato — imtihon to&apos;xtatildi. Urinish muvaffaqiyatsiz hisoblandi.
            </p>
            <Button variant="secondary" size="sm" onClick={() => onFinished(state)}>
              Natijani ko&apos;rish
            </Button>
          </div>
        )}

        {/* Javob qabul qilindi (o'zgartirib bo'lmaydi) — keyingi savolga o'tish. */}
        {currentQuestion && answeredId && !finishing && state.status === "IN_PROGRESS" && nextUnanswered !== null && (
          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={goNext} data-testid="exam-next" autoFocus>
              Keyingi savol
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/30 bg-brand/[0.06] px-4 py-2.5 text-sm" data-testid="exam-attempts-line">
          <span className="font-semibold text-foreground">{attemptsLine(state)}</span>
          <span className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground tabular-nums">
            <span>
              Xatolar: {state.wrongCount ?? 0} / {state.maxMistakes ?? 3}
            </span>
            <span>
              Javob berilgan: {total - unanswered}/{total}
            </span>
          </span>
        </div>

        <AnswerConfirmBar choice={pendingChoice} onConfirm={confirmAnswer} onCancel={() => setPending(null)} />

        <Card className="hidden p-4 sm:p-5 md:block">
          <QuestionNavigator total={total} currentIndex={currentIndex} statusByIndex={statusByIndex} bookmarkedIndexes={new Set()} onJump={goTo} />
        </Card>

        <MobileNavBar
          currentIndex={currentIndex}
          total={total}
          onPrev={() => goTo(currentIndex - 1)}
          onNext={() => goTo(currentIndex + 1)}
          onOpenSheet={() => setSheetOpen(true)}
          status={<MistakesBadge wrong={state.wrongCount ?? 0} max={state.maxMistakes ?? 3} className="h-7 px-2.5" testId="exam-mistakes-mobile" />}
        />
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
