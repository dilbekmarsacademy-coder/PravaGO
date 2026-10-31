"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftIcon, BookmarkIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkAnswer, getTopicQuestions, submitTestAttempt, type ApiQuestion, type CheckAnswerResult } from "@/lib/api/test";
import { getSavedPracticeQuestions } from "@/lib/api/saved";
import { LESSON_LOCKED_CODE } from "@/lib/api/lessons";
import { ApiError } from "@/lib/api/session";
import { nextCourseTopic, topicDayNumber, topicHref, topicPageHref } from "@/data/curriculum";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { FinishModal } from "@/components/test/FinishModal";
import { BottomSheet, MobileNavBar } from "@/components/test/MobileNavBar";
import { QuestionNavigator, type QuestionStatus } from "@/components/test/QuestionNavigator";
import { QuestionView, type TestMode } from "@/components/test/QuestionView";
import { ResultScreen } from "@/components/test/ResultScreen";
import { TestHeader } from "@/components/test/TestHeader";
import { testTimeLimitSec } from "@/config/rules";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { SAVED_PAGE_HREF, toggleSavedWithFeedback } from "@/lib/saved/actions";
import { topicBySlug } from "@/lib/saved/format";
import { track } from "@/lib/analytics";
import type { LocalizedText } from "@/lib/i18n/localized";
import { loadSavedIds, setSaved, useSavedState } from "@/lib/saved/store";
import { clearSession, loadSession, saveSession, takeLegacyBookmarks } from "@/lib/test/storage";
import { getTimeUrgency } from "@/lib/test/timer";

/**
 * Savollar manbai: bitta mavzu testi yoki saqlangan savollar (ixtiyoriy —
 * bitta mavzudagilari) bo'yicha mashq testi.
 */
export type TestSource = { kind: "topic"; topicSlug: string } | { kind: "saved"; topicSlug: string | null };

type SessionQuestion = ApiQuestion & { topicSlug: string };

interface TestSessionProps {
  source: TestSource;
  onlyQuestionIds: string[] | null;
  onRestart: () => void;
  onRetryWrong: (questionIds: string[]) => void;
  /** Kurs dasturida yo'q test (masalan "Yangi testlar" to'plami) sarlavhasi. */
  fallbackTitle?: LocalizedText;
}

interface QuestionAnswer {
  selectedOptionId: string | null;
  result: CheckAnswerResult | null;
}

type FinishReason = "manual" | "timeout";

// Hozircha faqat mashq rejimi ishlatiladi; imtihon rejimi uslublari tayyor.
const MODE: TestMode = "practice";

async function loadQuestions(source: TestSource): Promise<SessionQuestion[]> {
  if (source.kind === "saved") return getSavedPracticeQuestions(source.topicSlug);
  const questions = await getTopicQuestions(source.topicSlug);
  return questions.map((q) => ({ ...q, topicSlug: source.topicSlug }));
}

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

export function TestSession({ source, onlyQuestionIds, onRestart, onRetryWrong, fallbackTitle }: TestSessionProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [questions, setQuestions] = useState<SessionQuestion[] | null>(null);
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
  const { ids: savedIds } = useSavedState();

  const sourceKind = source.kind;
  const sourceSlug = source.topicSlug;
  // sessionStorage kaliti: mavzu testi — slug, saqlanganlar testi — alohida kalit.
  const sessionKey = source.kind === "topic" ? source.topicSlug : `saved:${source.topicSlug ?? "all"}`;

  const finish = useCallback((reason: FinishReason) => {
    setFinishReason((prev) => prev ?? reason);
    setFinishedAt((prev) => prev ?? Date.now());
    setFinishModalOpen(false);
    setSheetOpen(false);
  }, []);
  const handleTimeout = useCallback(() => finish("timeout"), [finish]);
  // Taymer savollar yuklangach (`startedAt`) boshlanadi — shu paytda soni ma'lum.
  const timeLimitSec = testTimeLimitSec(questions?.length ?? 0);
  const remainingSec = useCountdown(startedAt, timeLimitSec, !finished, handleTimeout);
  const urgency = getTimeUrgency(remainingSec, timeLimitSec);

  const topic = sourceSlug ? topicBySlug(sourceSlug) : undefined;
  const topicTitle = topic ? localize(topic.title, locale) : fallbackTitle ? localize(fallbackTitle, locale) : null;
  const header =
    sourceKind === "topic"
      ? {
          // Mavzu raqami — faqat kun ichidagi tartib (rasmiy test raqami ko'rsatilmaydi).
          testLabel: topic ? t.kabinet.topicPage.dayTopic(topicDayNumber(topic), topic.order) : null,
          title: topicTitle,
          backHref: "/kabinet",
        }
      : { testLabel: t.saved.title, title: topicTitle ?? t.saved.page.practiceTitle, backHref: SAVED_PAGE_HREF };

  useEffect(() => {
    let cancelled = false;
    loadQuestions(sourceKind === "topic" ? { kind: "topic", topicSlug: sourceSlug as string } : { kind: "saved", topicSlug: sourceSlug })
      .then((data) => {
        if (cancelled) return;
        const list = onlyQuestionIds ? data.filter((q) => onlyQuestionIds.includes(q.id)) : data;
        setQuestions(list);
        const saved = persist ? loadSession(sessionKey, list.map((q) => q.id)) : null;
        if (saved) {
          // Sahifa yangilangan — javoblar, joriy savol va taymer davom etadi.
          const resolved = Object.fromEntries(Object.entries(saved.answers).filter(([, a]) => a.result));
          setAnswers(resolved);
          setCurrentIndex(Math.min(saved.currentIndex, list.length - 1));
          setStartedAt(saved.startedAt);
        } else {
          setStartedAt(Date.now());
          if (sourceKind === "topic" && sourceSlug) track("test_start", { topicSlug: sourceSlug });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Video dars hali ko'rilmagan (to'g'ridan-to'g'ri URL orqali kirilgan) —
        // dars sahifasiga qaytaramiz; skeleton qoladi.
        if (err instanceof ApiError && err.status === 403 && err.code === LESSON_LOCKED_CODE) {
          const lockedTopic = sourceSlug ? topicBySlug(sourceSlug) : undefined;
          router.replace(lockedTopic ? topicPageHref(lockedTopic) : "/kabinet");
          return;
        }
        setError("loadError");
      });
    return () => {
      cancelled = true;
    };
  }, [sourceKind, sourceSlug, sessionKey, onlyQuestionIds, persist, router]);

  // Saqlangan savollar holati serverdan (javob/kalit so'zsiz, faqat id'lar).
  // Oldingi versiyada brauzerda saqlangan xatchoplar bir marta serverga ko'chiriladi.
  useEffect(() => {
    loadSavedIds({ force: true }).then(() => {
      if (sourceKind !== "topic" || !sourceSlug) return;
      for (const id of takeLegacyBookmarks(sourceSlug)) {
        setSaved(id, true, { topicSlug: sourceSlug }).catch(() => undefined);
      }
    });
  }, [sourceKind, sourceSlug]);

  // To'liq mavzu testi tugadi — natija serverga (foizni server javoblarni qayta
  // tekshirib hisoblaydi). Kabinetdagi 98% qoidasi shu natijalarga tayanadi.
  const attemptSent = useRef(false);
  useEffect(() => {
    if (!finished || !persist || sourceKind !== "topic" || !sourceSlug || !questions || attemptSent.current) return;
    attemptSent.current = true;
    const submitted = questions.flatMap((q, i) => {
      const answer = answers[i];
      return answer?.result && answer.selectedOptionId ? [{ questionId: q.id, optionId: answer.selectedOptionId }] : [];
    });
    submitTestAttempt(sourceSlug, submitted)
      .then((attempt) => track("test_finish", { topicSlug: sourceSlug, value: attempt.percent }))
      .catch(() => undefined);
  }, [finished, persist, sourceKind, sourceSlug, questions, answers]);

  // Holatni sessionStorage'ga yozib boramiz; test tugagach tozalanadi.
  useEffect(() => {
    if (!persist || !questions || startedAt === null) return;
    if (finished) {
      clearSession(sessionKey);
      return;
    }
    const resolved = Object.fromEntries(Object.entries(answers).filter(([, a]) => a.result));
    saveSession(sessionKey, {
      v: 1,
      questionIds: questions.map((q) => q.id),
      answers: resolved,
      currentIndex,
      startedAt,
    });
  }, [persist, questions, startedAt, finished, answers, currentIndex, sessionKey]);

  const currentQuestion = questions?.[currentIndex] ?? null;
  const currentAnswer = answers[currentIndex] ?? { selectedOptionId: null, result: null };
  const currentTopic = currentQuestion ? topicBySlug(currentQuestion.topicSlug) : undefined;

  const statusByIndex = useMemo(() => {
    const map: Record<number, QuestionStatus> = {};
    for (const [index, answer] of Object.entries(answers)) {
      if (!answer.result) continue;
      map[Number(index)] = MODE === "exam" ? "answered" : answer.result.correct ? "correct" : "incorrect";
    }
    return map;
  }, [answers]);

  const bookmarkedIndexes = useMemo(
    () => new Set((questions ?? []).flatMap((q, i) => (savedIds.has(q.id) ? [i] : []))),
    [questions, savedIds],
  );

  const answeredCount = Object.keys(statusByIndex).length;
  const unansweredCount = questions ? questions.length - answeredCount : 0;
  const correctCount = Object.values(answers).filter((a) => a.result?.correct).length;
  // To'liq mavzu testi o'tilsa — keyingi mavzu (kun tugasa, keyingi kunning 1-mavzusi).
  const nextTopic = persist && sourceKind === "topic" && topic ? nextCourseTopic(topic) : undefined;

  const goTo = useCallback(
    (index: number) => {
      if (!questions) return;
      if (index < 0 || index >= questions.length) return;
      setDirection(index >= currentIndex ? 1 : -1);
      setCurrentIndex(index);
    },
    [questions, currentIndex],
  );

  const toggleCurrentSaved = useCallback(() => {
    if (!currentQuestion) return;
    toggleSavedWithFeedback(currentQuestion.id, { topicSlug: currentQuestion.topicSlug, sourceMode: MODE }, t);
  }, [currentQuestion, t]);

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

  // Klaviatura: F1–F9 yoki 1–9 — variant tanlash, ←/→ — savollar orasida yurish,
  // S — joriy savolni saqlash/olib tashlash.
  useEffect(() => {
    if (!currentQuestion || finished) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const fMatch = /^F([1-9])$/.exec(event.key);
      // F1 (yordam), F3 (qidiruv), F5 (yangilash) — brauzer amallarini doim bloklaymiz.
      if (fMatch && Number(fMatch[1]) <= 5) event.preventDefault();
      // Modal, bottom sheet yoki lightbox ochiq bo'lsa, test tugmalari ishlamaydi.
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
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
      } else if (event.code === "KeyS" && !event.repeat) {
        // `code` — kirill/rus klaviatura joylashuvida ham shu jismoniy tugma.
        event.preventDefault();
        toggleCurrentSaved();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentQuestion, finished, handleAnswer, goTo, currentIndex, toggleCurrentSaved]);

  const elapsedSec =
    startedAt !== null && finishedAt !== null
      ? Math.min(timeLimitSec, Math.round((finishedAt - startedAt) / 1000))
      : 0;

  const isEmpty = questions !== null && questions.length === 0;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Vaqt tugayotganini ekran chetlari rangi bilan bildiramiz. */}
      {!finished && !isEmpty && urgency !== "normal" && (
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
      {!finished && !isEmpty && urgency !== "normal" && (
        <p className="sr-only" role="status">
          {t.testSession.timeRunningOut}
        </p>
      )}

      <TestHeader
        testLabel={header.testLabel}
        title={header.title}
        backHref={header.backHref}
        remainingSec={remainingSec}
        limitSec={timeLimitSec}
        urgency={urgency}
        canFinish={questions !== null && !finished && !isEmpty}
        showTimer={!finished && !isEmpty}
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

        {isEmpty && (
          <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-8 text-center sm:p-10">
            <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
              <BookmarkIcon className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{t.saved.page.emptyTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.saved.page.emptyDesc}</p>
            </div>
            <Link href={header.backHref} className={buttonClasses({ variant: "secondary", size: "md" })}>
              <ArrowLeftIcon className="size-4" />
              {t.saved.title}
            </Link>
          </Card>
        )}

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
                  bookmarked={savedIds.has(currentQuestion.id)}
                  videoHref={currentTopic ? `/kabinet/mavzu/${currentTopic.id}` : null}
                  onToggleBookmark={toggleCurrentSaved}
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
            nextHref={nextTopic ? topicHref(nextTopic) : null}
            onRestart={onRestart}
            onRetryWrong={onRetryWrong}
          />
        )}
      </main>

      <FinishModal
        open={finishModalOpen && !finished}
        unanswered={unansweredCount}
        remainingSec={remainingSec}
        correct={correctCount}
        total={questions?.length ?? 0}
        onContinue={() => setFinishModalOpen(false)}
        onFinish={() => finish("manual")}
      />
    </div>
  );
}

/** Yuklanish paytidagi skelet — haqiqiy joylashuvni takrorlaydi (layout shift yo'q). */
function TestSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="grid gap-5 twocol:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] twocol:gap-6 lg:gap-8">
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
